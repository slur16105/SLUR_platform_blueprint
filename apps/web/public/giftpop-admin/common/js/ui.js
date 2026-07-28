UI = {
	load: function(){
		$(window).load(function(){

		});
	},

	ready : function(){		
		$(document).ready(function(){
			UI.fn_gnb();
			UI.fn_accordion();
			UI.fn_favorite();
			UI.fn_banner();
			

		});
	},

	fn_gnb : function(){
		var	gnb = $('#gnb > ul');
		var	depth_01 = gnb.children();

		depth_01.on('click focusin', function(){				
			depth_01.removeClass('open');
			$(this).addClass('open');
			$(this).siblings().find('.depth_02').slideUp(300);
			$(this).find('.depth_02').slideDown(300);
		});

		var menu_flag = false;

		$('#btn_all').on('click', function(){
			if(!menu_flag){
				$('#all_menu').fadeIn(0);
				$('#all_menu .menu').append($('#gnb').html());
				menu_flag = true;
			}
		});

		$('#all_menu .btn_close').on('click', function(){
			$('#all_menu').fadeOut(0);
			$('#all_menu .menu').empty();
			menu_flag = false;
		});
	},

	fn_accordion : function(){
		if($('.search_accordion').length == 0){return;}

		var accordion = $('.search_accordion');
		var btn_accordion = accordion.find('.btn_accordion button');

		btn_accordion.on('click',function(){
			if(!accordion.hasClass('open')){
				accordion.addClass('open');
			}else{
				accordion.removeClass('open');
			}
		});
	},

	fn_faq : function(){
		if($('.sub_faq').length == 0){return;}

		var faq_a = $('.faq_list .q button');

		faq_a.on('click',function(){
			$(this).parent().parent().siblings().removeClass('open');
			$(this).parent().parent().addClass('open');
		});
	},

	fn_tab : function(tab_btn,tab_cont){
		var tab_btn = $(tab_btn).children();
		var tab_cont = $(tab_cont).children();

		tab_btn.each(function(i){this.num = i});
		tab_btn.on('click',function(){
			tab_btn.removeClass('on');
			$(this).addClass('on');
			tab_cont.removeClass('on');
			tab_cont.eq(this.num).addClass('on');
		});
	},
	fn_message : function(){
		$('.popup_message .slider').slick({
			dots: false,
			draggable: false,
			infinite: true,
		});
	},
	fn_favorite : function(){
		$('#btn_favorite').on('click',function(){
			if(!$(this).hasClass('on')){
				$(this).addClass('on');
			}else{
				$(this).removeClass('on');
			}
		});
	},
	fn_banner : function(){
		var popup_image = $('.popup_image ');
		var banner_list = popup_image.find('.image_list ul').children();
		var banner = popup_image.find('.image_preview .banner');

		banner_list.each(function(i){this.num = i});

		banner_list.on('click',function(){
			banner.empty();
			banner.append($(this).find('img').clone());
		});
	},
	fn_txtcnt : function(txt_cnt,limit){
		var txt_cnt = $(txt_cnt);

		txt_cnt.find('input').keyup(function (e){
			var content = $(this).val();
			$(this).parent().find('.cnt').html(content.length); 
		
			if (content.length > limit){
				$(this).val(content.substring(0, limit));
				$(this).parent().find('.cnt').html(limit);
			}
		});

	}

}

UI.load();
UI.ready();

var Layer_OPEN = function (obj){
	$('html').addClass('fixed');
	$(obj).addClass('open');
};

var Layer_CLOSE = function (obj){
	$('html').removeClass('fixed');
	$(obj).removeClass('open');
};
