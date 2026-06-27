(function() {
	window.Router = function() {
		var self = this;

		self.hashList = {}; /* route table */
		self.index = null;
		self.key = '!';

		window.onhashchange = function() {
			self.reload();
		};
	};

	/**
	 * Add route; overwrites if it already exists
	 * @param addr: path
	 * @param callback: callback invoked with route params
	 */
	Router.prototype.add = function(addr, callback) {
		var self = this;

		self.hashList[addr] = callback;
	};

	/**
	 * Delete route
	 * @param addr: path
	 */
	Router.prototype.remove = function(addr) {
		var self = this;

		delete self.hashList[addr];
	};

	/**
	 * Set home page path
	 * @param index: home page path
	 */
	Router.prototype.setIndex = function(index) {
		var self = this;

		self.index = index;
	};


	/**
	 * Navigate to path
	 * @param addr: path value
	 */
	Router.prototype.go = function(addr) {
		var self = this;

		window.location.hash = '#' + self.key + addr;
	};

	/**
	 * Reload page
	 */
	Router.prototype.reload = function() {
		var self = this;

		var hash = window.location.hash.replace('#' + self.key, '');
		//var addr = hash.split('/')[0];
		var addr = hash;
		var cb = getCb(addr, self.hashList);
		if(cb != false) {
			var arr = hash.split('/');
			arr.shift();
			cb.apply(self, arr);
		}
		else {
			self.index && self.go(self.index);	
		}
	};

	/**
	 * Start routing so direct URL access triggers callbacks
	 */
	Router.prototype.start = function() {
		var self = this;

		self.reload();
	}

	/**
	 * Get callback
	 * @return false or callback
	 */
	function getCb(addr, hashList) {
		for(var key in hashList) {
			if(key == addr) {
				return hashList[key]	
			}
		}
		return false;
	}
})();