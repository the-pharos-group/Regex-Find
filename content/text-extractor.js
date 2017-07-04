
const {classes: Cc, interfaces: Ci, utils: Cu}=Components;

// var EXPORTED_SYMBOLS = ['textExtractor'];
var EXPORTED_SYMBOLS = ['TextExtractor'];


function fbNodeInfo() {}
fbNodeInfo.prototype = {
  mDocumentOffset: null,
  mNodeOffset: null,
  mLength: null,
  mNode: null
}

function TextExtractor() {}
TextExtractor.prototype = {
  
  mTextContent: '',
  mDocument: null,
  mNodeContent: [],
  initialized: false,
  
  
  init: function(document, range) {
    // if(this.initialized) return;
    
    if (!document) throw Components.results.NS_ERROR_INVALID_ARG;
      
    this.mDocument = null;
    this.mTextContent = '';
    this.mNodeContent = [];
    // if(this.mNodeContent.length != 0) return;
    
    var currentNode;
    var endNode;
    var startOffset = 0;
    var endOffset = 0;
    
    if (!range) {
      if (document instanceof Ci.nsIDOMHTMLDocument)
        endNode = document.body;
      else
        endNode = document.documentElement;
      
      if (!endNode) {
        this.mDocument = document;
        return;
      }
      
      currentNode = endNode.firstChild;
      if (!currentNode) {
        this.mDocument = document;
        return NS_OK;
      }
    }
    else {
      var type;
      var children;

      endNode = range.endContainer;
      endOffset = range.endOffset;
      type = endNode.nodeType;

      if (type == Ci.nsIDOMNode.ELEMENT_NODE) {
        children = endNode.childNodes;
        endNode = children[endOffset-1];
      }

      currentNode = range.startContainer;
      startOffset = range.startOffset;
      type = currentNode.nodeType;
      
      if ((type == Ci.nsIDOMNode.ELEMENT_NODE) && (startOffset>0)) {
        children = currentNode.childNodes;
        var length = children.length;
        
        if (startOffset<length)
          currentNode = children[startOffset];
        else if (length > 0)
          currentNode = this.walkPastTree(currentNode, endNode);
        
        startOffset = 0;
      }
    }

    var view = document.defaultView;
    
    while (currentNode) {
      var type = currentNode.nodeType;
      
      var nextNode;
      if ( (type == Ci.nsIDOMNode.TEXT_NODE) || (type == Ci.nsIDOMNode.CDATA_SECTION_NODE) ) {
        if (currentNode != endNode)
          this.addTextNode(currentNode, startOffset);
        else
          this.addTextNode(currentNode, startOffset, endOffset);
        
        nextNode = this.walkPastTree(currentNode, endNode);
        currentNode = nextNode;
        startOffset = 0;
        
        continue;
      }
      
      startOffset = 0;
      if ((type == Ci.nsIDOMNode.ELEMENT_NODE) && view) {
        var style = view.getComputedStyle(currentNode, '');
        var display = style.getPropertyValue("display");
        
        if (display=="none") {
          nextNode = this.walkPastTree(currentNode, endNode);
          currentNode = nextNode;
          continue;
        }
      }
      
      nextNode = this.walkIntoTree(currentNode, endNode);
      currentNode = nextNode;
    }
    
    this.mDocument = document;
    // this.initialized = true;
  },
  
  
  addTextNode: function(node, offset, length) {
    var text;
    if (length)
      text = node.nodeValue.substring(offset, length);
    else
      text = node.nodeValue.substring(offset);

    nodeInfo = new fbNodeInfo();
    nodeInfo.mLength = text.length;

    if (nodeInfo.mLength > 0) {
      nodeInfo.mDocumentOffset = this.mTextContent.length;
      nodeInfo.mNodeOffset = offset;
      nodeInfo.mNode = node;

      this.mTextContent += text;
      
      this.mNodeContent.push(nodeInfo);
    }
  },

  walkPastTree: function(current, limit) {
    var next;

    do {
      if (current == limit) // Cannot move past our limit
        break;

      next = current.nextSibling;
      if (!next) { // No siblings. Move out a step and try again.
        current = current.parentNode;
        next = null;
      }

    } while ((!next) && (current)); // Until we find a node or run out of nodes.
    
    return next;
  },

  walkIntoTree: function(current, limit) {
    var next;

    next = current.firstChild; // Attempt to recurse in
    if (!next)
      next = this.walkPastTree(current, limit);
    
    return next;
  },
  
  
  seekOffsetPosition: function(offset, start, end) {
    if (end <= (start+1))
      return start;
    
    var diff = this.mNodeContent[end].mDocumentOffset - this.mNodeContent[start].mDocumentOffset;
    var offs = offset - this.mNodeContent[start].mDocumentOffset;
    var mid = Math.floor( start + ( offs / (diff * 1.0 / (end - start)) ) );
    
    var off = this.mNodeContent[mid].mDocumentOffset;
    if (off > offset)
      return this.seekOffsetPosition(offset, start, mid);
    
    var offLen = this.mNodeContent[mid].mDocumentOffset + this.mNodeContent[mid].mLength;
    if (offLen <= offset)
      return this.seekOffsetPosition(offset, mid + 1, end);
    
    return mid;
  },

  getOffsetPosition: function(offset, start) {
    var end = this.mNodeContent.length - 1;
    if (this.mNodeContent[end].mDocumentOffset <= offset)
      return end;
    
    return this.seekOffsetPosition(offset, start, end);
  },

  getTextRange: function(offset, length) {
    if (!this.mDocument) throw Components.results.NS_ERROR_NOT_INITIALIZED;
    
    var range = this.mDocument.createRange();

    var pos1 = this.getOffsetPosition(offset, 0);
    var n1 = this.mNodeContent[pos1].mNode;
    var off1 = offset - this.mNodeContent[pos1].mDocumentOffset + this.mNodeContent[pos1].mNodeOffset;
    
    var pos2 = this.getOffsetPosition(offset + length, pos1);
    var n2 = this.mNodeContent[pos2].mNode;
    var off2 = (offset + length) - this.mNodeContent[pos2].mDocumentOffset + this.mNodeContent[pos2].mNodeOffset;
    
    range.setStart(n1, off1);
    range.setEnd(n2, off2);
    
    return range;
  },
  
}
