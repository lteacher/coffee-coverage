// Generated by CoffeeScript 2.0.1
(function() {
  var NodeWrapper, _, assert, coffeeScript, compile, forNodeAndChildren;

  assert = require('assert');

  coffeeScript = require('coffeescript');

  _ = require('lodash');

  // Wraps a `node` returned from coffeescript's `nodes()` method.

  // Properties:
  // * `node` - The original coffeescript node.
  // * `parent` - A `NodeWrapper` object for the parent of the coffeescript node.
  // * `childName` - A coffeescript node has multiple named children.  This is the name of the
  //   attribute which contains this node in `@parent.node`.  Note that `@parent.node[childName]`
  //   may be a single Node or it may be an array of nodes, depending on the implementation of the
  //   specific node type.
  // * `childIndex` - Where `@parent.node[childName]` is an array, this is the index of `@node`
  //   in `@parent.node[childName]`.  Note that inserting new nodes will obviously invalidate this
  //   value, so this is more of a "hint" than a hard and fast truism.
  // * `depth` - The depth in the AST from the root node.
  // * `type` - Copy of @node.constructor.name.
  // * `locationData` - Copy of @node.locationData.
  // * `isStatement` - true if this node is a statement.

  module.exports = NodeWrapper = class NodeWrapper {
    constructor(node1, parent, childName1, childIndex1, depth = 0) {
      var ref, ref1;
      this.node = node1;
      this.parent = parent;
      this.childName = childName1;
      this.childIndex = childIndex1;
      this.depth = depth;
      assert(this.node);
      this.locationData = this.node.locationData;
      this.type = ((ref = this.node.constructor) != null ? ref.name : void 0) || null;
      // TODO: Is this too naive?  coffeescript nodes have a `isStatement(o)` function, which
      // really only cares about `o.level`.  Should we be working out the level and calling
      // this function instead of trying to figure this out ourselves?
      this.isStatement = (this.parent != null) && this.type !== 'Comment' && this.parent.type === 'Block' && this.childName === 'expressions';
      // Note we exclude 'Value' nodes.  When you parse a Class, you'll get Value nodes wrapping
      // each contiguous block of function assignments, and we don't want to treat these as
      // statements.  I can't think of another case where you have a Value as a direct child
      // of an expression.
      if (this.isStatement && this.type === 'Value' && ((ref1 = this.parent.parent) != null ? ref1.type : void 0) === 'Class') {
        this.isStatement = false;
      }
      this.isSwitchCases = this.childName === 'cases' && this.type === 'Array';
    }

    // Run `fn(node)` for each child of this node.  Child nodes will be automatically wrapped in a
    // `NodeWrapper`.

    forEachChild(fn) {
      if (this.node.children != null) {
        return this.node.children.forEach((childName) => {
          return this.forEachChildOfType(childName, fn);
        });
      }
    }

    // Like `forEachChild`, but only
    forEachChildOfType(childName, fn) {
      var child, childNodes, children, index, results, wrappedChild;
      children = this.node[childName];
      if (children != null) {
        childNodes = _.flatten([children], true);
        index = 0;
        results = [];
        while (index < childNodes.length) {
          child = childNodes[index];
          if (child.constructor.name != null) {
            wrappedChild = new NodeWrapper(child, this, childName, index, this.depth + 1);
            fn(wrappedChild);
          }
          results.push(index++);
        }
        return results;
      }
    }

    // Mark this node and all descendants with the given flag.
    markAll(varName, value = true) {
      var markCoffeeNode;
      markCoffeeNode = function(coffeeNode) {
        if (coffeeNode.coffeeCoverage == null) {
          coffeeNode.coffeeCoverage = {};
        }
        coffeeNode.coffeeCoverage[varName] = value;
        return coffeeNode.eachChild(markCoffeeNode);
      };
      return markCoffeeNode(this.node);
    }

    // Mark a node with a flag.
    mark(varName, value = true) {
      var base;
      if ((base = this.node).coffeeCoverage == null) {
        base.coffeeCoverage = {};
      }
      return this.node.coffeeCoverage[varName] = value;
    }

    isMarked(varName, value = true) {
      var ref;
      return ((ref = this.node.coffeeCoverage) != null ? ref[varName] : void 0) === value;
    }

    // Returns a NodeWrapper for the given child.  This only works if the child is not an array
    // (e.g. `Block.expressions`)
    child(name, index = null) {
      var child;
      child = this.node[name];
      if (!child) {
        return null;
      }
      if (index == null) {
        assert(!_.isArray(child));
        return new NodeWrapper(child, this, name, 0, this.depth + 1);
      } else {
        assert(_.isArray(child));
        if (!child[index]) {
          return null;
        }
        return new NodeWrapper(child[index], this, name, index, this.depth + 1);
      }
    }

    // `@childIndex` is a hint, since nodes can move around.  This updateds @childIndex if
    // necessary.
    _fixChildIndex() {
      var childIndex;
      if (!_.isArray(this.parent.node[this.childName])) {
        return this.childIndex = 0;
      } else {
        if (this.parent.node[this.childName][this.childIndex] !== this.node) {
          childIndex = _.indexOf(this.parent.node[this.childName], this.node);
          if (childIndex === -1) {
            throw new Error("Can't find node in parent");
          }
          return this.childIndex = childIndex;
        }
      }
    }

    // Returns this node's next sibling, or null if this node has no next sibling.

    next() {
      var nextNode, ref;
      if ((ref = this.parent.type) !== 'Block' && ref !== 'Obj') {
        return null;
      }
      this._fixChildIndex();
      nextNode = this.parent.node[this.childName][this.childIndex + 1];
      if (nextNode == null) {
        return null;
      } else {
        return new NodeWrapper(nextNode, this.parent, this.childName, this.childIndex + 1, this.depth);
      }
    }

    _insertBeforeIndex(childName, index, csSource) {
      var compiled;
      assert(_.isArray(this.node[childName]), `${this.toString()} -> ${childName}`);
      compiled = compile(csSource, this.node);
      return this.node[childName].splice(index, 0, compiled);
    }

    // Insert a new node before this node (only works if this node is in an array-based attribute,
    // like `Block.expressions`.)

    // Note that generated nodes will have the `node.coffeeCoverage.generated` flag set,
    // and will be skipped when instrumenting code.

    insertBefore(csSource) {
      this._fixChildIndex();
      return this.parent._insertBeforeIndex(this.childName, this.childIndex, csSource);
    }

    insertAfter(csSource) {
      this._fixChildIndex();
      return this.parent._insertBeforeIndex(this.childName, this.childIndex + 1, csSource);
    }

    // Insert a chunk of code at the start of a child of this node.  E.g. if this is a Block,
    // then `insertAtStart('expressions', 'console.log "foo"'')` would add a `console.log`
    // statement to the start of the Block's expressions list.

    // Note that generated nodes will have the `node.coffeeCoverage.generated` flag set,
    // and will be skipped when instrumenting code.

    insertAtStart(childName, csSource) {
      var child, ref;
      child = this.node[childName];
      if (this.type === 'Block' && childName === 'expressions') {
        if (!child) {
          return this.node[childName] = [compile(csSource, this.node)];
        } else {
          return this.node[childName].unshift(compile(csSource, this.node));
        }
      } else if ((child != null ? (ref = child.constructor) != null ? ref.name : void 0 : void 0) === 'Block') {
        return child.expressions.unshift(compile(csSource, child));
      } else if (!child) {
        // This will generate a 'Block'
        return this.node[childName] = compile(csSource, this.node);
      } else {
        throw new Error(`Don't know how to insert statement into ${this.type}.${childName}: ${this.type[childName]}`);
      }
    }

    toString() {
      var answer, ref;
      answer = '';
      if (this.childName) {
        answer += `${this.childName}[${this.childIndex}]:`;
      }
      answer += this.type;
      if (this.node.locationData != null) {
        answer += ` (${((ref = this.node.locationData) != null ? ref.first_line : void 0) + 1}:${this.node.locationData.first_column + 1})`;
      }
      return answer;
    }

  };

  forNodeAndChildren = function(node, fn) {
    fn(node);
    return node.eachChild(fn);
  };

  compile = function(csSource, node) {
    var compiled, line;
    compiled = coffeeScript.nodes(csSource);
    line = node.locationData.first_line;
    forNodeAndChildren(compiled, function(n) {
      // Fix up location data for each instrumented line.  Make these all 0-length,
      // so we don't have to rewrite the location data for all the non-generated
      // nodes in the tree.
      n.locationData = {
        first_line: line - 1, // -1 because `line` is 1-based
        first_column: 0,
        last_line: line - 1,
        last_column: 0
      };
      // Mark each node as coffee-coverage generated, so we won't try to instrument our
      // instrumented lines.
      if (n.coffeeCoverage == null) {
        n.coffeeCoverage = {};
      }
      return n.coffeeCoverage.generated = true;
    });
    return compiled;
  };

}).call(this);