// Auto-resize iframe
$(window).on('resize', function() {
	var $content = $('.content');
	$content.height($(this).height() - 120);
	$content.find('iframe').each(function() {
		$(this).height($content.height());
	});
}).resize();


var vm = new Vue({
	el:'#rrapp',
	data:{
		main:"main.html",
        navTitle:"Welcome"
	},
    methods: {
        donate: function () {
            layer.open({
                type: 2,
                title: false,
                area: ['806px', '467px'],
                closeBtn: 1,
                shadeClose: false,
                content: ['http://cdn.renren.io/donate.jpg', 'no']
            });
        }
    }
});

// Routing
var router = new Router();
var menus = ["main.html","generator.html"];
routerList(router, menus);
router.start();

function routerList(router, menus){
	for(var index in menus){
		router.add('#'+menus[index], function() {
			var url = window.location.hash;

			// Replace iframe url
			vm.main = url.replace('#', '');

			// Expand nav menu
			$(".treeview-menu li").removeClass("active");
			$("a[href='"+url+"']").parents("li").addClass("active");

			vm.navTitle = $("a[href='"+url+"']").text();
		});
	}
}
