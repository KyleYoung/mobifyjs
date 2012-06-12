(function(Mobify, $) {

var emitDust = function(elem, context, bodies, extras) {
        if (extras === "exists")
            return this.exists(elem, context, bodies);

        if (extras === "notexists")
            return this.notexists(elem, context, bodies);

        return (bodies === null)
        ? this.reference(elem, context, extras.auto, extras.filters)
        : this.section(elem, context, bodies, extras);
    }
  , asyncEmitDust = function(chunk) {
        var mobject = this,
            args = [].slice.call(arguments, 1);

        args.unshift(mobject._dustProxy || mobject);

        return chunk.map(function(chunk) {
            mobject.on("complete", function() {
                emitDust.apply(chunk, args).end();
            })
        });
    }
  , MObject = Mobify.MObject = function() {
        var mobject = this;
        this._outstanding = [];
        this._on = { "complete": [], "done": [] };
        this._empties = {};
        this._subMObjects = [];
        this._callable = function() {
            if (mobject.done()) return mobject;
            return asyncEmitDust.apply(mobject, arguments);
        };

        MObject.all.push(this);
    }
  , isEmpty = MObject.isEmpty = function(value) {
        return (value === null) || (value === undefined) || (value === '')
            || ((typeof value === "object") && (typeof value.length === "number")
                && !value.length && !value.tagName)
            || (value instanceof Error);
    };

MObject.all = [];
MObject.prototype = {
    done: function() { return !this._outstanding.length }
  , _iterate: function(isChoose, source) {
        var source = $.isArray(source[0]) ? source[0] : source
          , mobject = this;

        for (var i = 0, l = source.length; i < l; ++i) {
            var addition = source[i];
            try {
                if (typeof addition == "function") {
                    addition.call(mobject, mobject);                    
                } else {
                    $.each(addition, function(key, value) {
                        mobject.set(key, value);
                    });
                }
                if (isChoose) break;
            } catch (e) {
                if (e === mobject._M.stopper) throw e;
            }
        }
        return this;
    }
  , choose: function() {
        this._iterate.call(this, true, arguments);
        this._choice = true;
        return this;
    }
  , add: function() {
        this._iterate.call(this, false, arguments);
        return this;
    }
  , addTo: function(obj, key) {
        obj.add({key : this});
        return this;
    }
  , get: function(what) {
        var source = $.isArray(what) ? what
            : typeof what === "string" ? what.split('.')
            : arguments;

        var walk = this;
        for (var i = 0, l = source.length; i < l; ++i) {
            if (walk === undefined) return;
            walk = walk[source[i]];
        }
        return walk;
    }
  , set: function(key, value) {
        var importance = this._setImportance;
        this._setImportance = 0;

        if (typeof value === "function") {
            try {
                value = value.call(this, this);
            } catch(e) {
                if (e === mobject._M.stopper) throw e;
                value = e;
            }
        }

        if ((importance !== -1) && (importance || Mobify.config.isDebug)) {
            var valueEmpty = isEmpty(value) || (!value && importance);

            if (!valueEmpty) {
                delete this._empties[key];
            } else if (importance) {
                throw new Error("Missed key " + key);
            } else {
                this._empties[key] = value;
            }
        }
        this[key] = value;
        if (value instanceof MObject) value._subMObjects.push({parent: this, key: key});
    }
  , can: function() {
        this._setImportance = -1;
        return this;
    }
  , must: function() {
        this._setImportance = 1;
        return this;
    }
  , on: function(event, fn) {
        var mobject = this;
        this._on[event].push(fn);

        if (event === "complete") this._attemptCompletion();
        return mobject;
    }
  , _attemptCompletion: function() {
        if (this.done()) {
            var completer;
            while (this._on && (completer = this._on.complete.shift())) {
                completer.call(this);
            }
        }
    }
  , async: function(fn) {
        var mobject = this;

        var init = function() {
            fn.call(mobject, mobject, done);
        }
        var done = function(extender) {
            if (extender) mobject.add(extender);

            if (!mobject._outstanding) return;
            var index = mobject._outstanding.indexOf(init);
            mobject._outstanding.splice(index, 1);
            mobject._attemptCompletion();
        };
        mobject._outstanding.push(init);
        init();
        return mobject;
    }
  , end: function(htmlStr) {
        this.outerHTML = htmlStr;
        return this._M.end(this);
    }
  , tmpl: function(template, callback) {
        var M = this._M;
        callback = callback || M._emitTemplatingResult;

        return this.async(function(data, done) {
            return M.tmpl(template, data, function(err, result) {
                callback(err, result);
                done();
            });
        });
    }
  , _delayInspection : function() {
        var ctx = this;
        return this._M().async(function(unwrap, done) {
            unwrap._dustProxy = ctx;
            ctx.on("complete", done);
        });     
    }    
};

})(Mobify, Mobify.$);