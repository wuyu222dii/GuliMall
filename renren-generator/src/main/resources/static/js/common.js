// jqGrid configuration
$.jgrid.defaults.width = 1000;
$.jgrid.defaults.responsive = true;
$.jgrid.defaults.styleUI = 'Bootstrap';

// Utility helpers
window.T = {};

// Get query string parameters
// Usage example
// location.href = http://localhost:8080/index.html?id=123
// T.p('id') --> 123;
var url = function(name) {
	var reg = new RegExp("(^|&)"+ name +"=([^&]*)(&|$)");
	var r = window.location.search.substr(1).match(reg);
	if(r!=null)return  unescape(r[2]); return null;
};
T.p = url;

// Global config
$.ajaxSetup({
	dataType: "json",
	contentType: "application/json",
	cache: false
});

function hasPermission(permission) {
    if (window.parent.permissions.indexOf(permission) > -1) {
        return true;
    } else {
        return false;
    }
}

// Override alert
window.alert = function(msg, callback){
	parent.layer.alert(msg, function(index){
		parent.layer.close(index);
		if(typeof(callback) === "function"){
			callback("ok");
		}
	});
}

// Override confirm dialog
window.confirm = function(msg, callback){
	parent.layer.confirm(msg, {btn: ['OK','Cancel']},
	function(){// Confirm handler
		if(typeof(callback) === "function"){
			callback("ok");
		}
	});
}

// Select one record
function getSelectedRow() {
    var grid = $("#jqGrid");
    var rowKey = grid.getGridParam("selrow");
    if(!rowKey){
    	alert("Please select a record");
    	return ;
    }
    
    var selectedIDs = grid.getGridParam("selarrrow");
    if(selectedIDs.length > 1){
    	alert("Only one record can be selected");
    	return ;
    }
    
    return selectedIDs[0];
}

// Select multiple records
function getSelectedRows() {
    var grid = $("#jqGrid");
    var rowKey = grid.getGridParam("selrow");
    if(!rowKey){
    	alert("Please select a record");
    	return ;
    }
    
    return grid.getGridParam("selarrrow");
}