UI = {
	load: function(){
		$(window).load(function(){

		});
	},

	ready : function(){		
		$(document).ready(function(){
			UI.fn_main();
			UI.fn_gnb();
			UI.fn_topBanner();
			UI.fn_hash();
			UI.fn_bigBanner();
			UI.fn_wing();
			UI.fn_join();
			UI.fn_order();
		});
	},

	fn_main : function(){
		if($('#main_contents').length == 0){return;}
		$('#wrap').addClass('main');
	},

	fn_topBanner : function(){
		var banner = $('#header .banner');
		var banner_close = banner.find('.btn_close');
		banner_close.on('click',function(){
			banner.slideUp(100);
		});
	},

	fn_hash : function(){
		var hashtag = new Swiper('.hashtag .swiper-container', {
			loop: true,
			slidesPerView: 3,
			allowTouchMove: false,
			navigation: {
				nextEl: '.hashtag .btn_next',
				prevEl: '.hashtag .btn_prev',
			}
		});
	},

	fn_bigBanner : function(){
		var banner_btn = $('.banner_btn div button');
		var banner_control = $('.big_banner .btn_control');
		var banner_autoplay = $('.banner_img .control button');
		var bigBanner = new Swiper('.banner_img', {
			loop: true,
			allowTouchMove: false,
			autoplay: {
				delay: 2000,
			},			
			navigation: {
				nextEl: '.banner_img .btn_next',
				prevEl: '.banner_img .btn_prev',
			},
			on:{
				slideChangeTransitionStart: function(){
					banner_btn.removeClass('active');
					banner_btn.eq(this.realIndex).addClass('active');
				},
			}
		});
		banner_btn.on('click',function(){
			var sliderNo = $(this).index();
			banner_btn.removeClass('active');
			$(this).addClass('active');
			bigBanner.slideTo(sliderNo+1);
			bigBanner.autoplay.start();
		});
		banner_autoplay.on('click',function(){
			if(!banner_control.hasClass('pause')){
				bigBanner.autoplay.start();
			}
		});
		banner_control.on('click',function(){
			if(!$(this).hasClass('pause')){
				$(this).addClass('pause');
				bigBanner.autoplay.stop();
			}else{
				$(this).removeClass('pause');
				bigBanner.autoplay.start();
			}
		});
	},

	fn_wing : function(){
		if($('#wing').length == 0){return;}
		var wing = $('#wing');
		var wing_top = wing.offset().top;
		var btn_recommend = wing.find('.btn_recommend');
		var recommend = $('#recommend_box');
		var wing_slider = new Swiper('#wing .slider', {
			loop: true,
			autoHeight: true,
			allowTouchMove: false,
			pagination: {
				el: '.swiper-pagination',
				type: 'fraction',
			},
			navigation: {
				nextEl: '#wing .slider .btn_next',
				prevEl: '#wing .slider .btn_prev',
			}
		});
		$(window).scroll(function(){
			sTop = $(window).scrollTop();
			if ( sTop >= wing_top - 20){
				wing.addClass('fixed');
				recommend.addClass('fixed');
			}else{
				wing.removeClass('fixed');
				recommend.removeClass('fixed');
			}
		});
		btn_recommend.on('click',function(){
			if(!$(this).hasClass('on')){
				$(this).addClass('on');
				recommend.addClass('open');
			}else{
				$(this).removeClass('on');
				recommend.removeClass('open');
			};
		});
	},
	fn_gnb : function(){
		var header = $('#header'),
			gnb = $('#gnb > ul'),
			btn_quick = header.find('.btn_quick'),
			quick_menu = header.find('.quick_menu'),
			depth1 = gnb.children();
		depth1.on('mouseover focusin', function(){				
			$(this).addClass('on');
			header.addClass('open');
		});
		header.on('mouseleave focusout', function(){
			header.removeClass('open');	
		});
		btn_quick.on('click', function(){
			btn_quick.toggleClass('on');
			quick_menu.toggleClass('open');
		});
		var search = header.find('.search input');
		var keyword_box = header.find('.keyword_box');
		var keyword_box_close = keyword_box.find('.btn_close');
		search.on('focusin', function(){				
			$(this).addClass('on');
			keyword_box.addClass('open');
		});
		keyword_box_close.on('click', function(){
			keyword_box.removeClass('open');	
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
	fn_join : function(){
		if($('.join_form').length == 0){return;}
		var terms_box = $('.terms_box').children();
		var terms_switch = terms_box.find('.btn_switch');
		terms_switch.on('click',function(){
			$(this).parent().toggleClass('open');
		});
		$('#chk_all').on('click',function(){
			if ($('#chk_all').prop('checked')){
				$(".terms_box input[type=checkbox]").prop("checked",true);
			}else{
				$(".terms_box input[type=checkbox]").prop("checked",false);
			}
		});
	},
	fn_chk : function(chk,chk_all){
		var chk = $(chk);
		var chk_all = $(chk_all).find('input[type=checkbox]');
		chk.on('click',function(){
			if (chk.prop('checked')){
				chk_all.prop("checked",true);
			}else{
				chk_all.prop("checked",false);
			}
		});
	},
	fn_order : function(){
		if($('.sub_order').length == 0){return;}
		var order_wing = $('.order_wing');
		$(window).scroll(function(){
			sTop = $(window).scrollTop();
			if ( sTop >= $('.sub_order').offset().top + 230){
				order_wing.addClass('fixed');
			}else{
				order_wing.removeClass('fixed');
			}
		});
	},
	fn_message_pop : function(){
		var message_pop = new Swiper('.popup_message_02 .swiper-container', {
			// effect: 'fade',
			loop: true,
			allowTouchMove: false,
			pagination: {
				el: '.swiper-pagination',
				type: 'fraction',
			},
			navigation: {
				nextEl: '.popup_message_02 .btn_next',
				prevEl: '.popup_message_02 .btn_prev',
			}
		});
	},
	fn_accordion : function(accordion){
		var accordion = $(accordion).find('.tbody ul').children();
		var btn = accordion.find('.btn_switch');
		btn.each(function(i){this.num = i});
		btn.on('click',function(){
			accordion.eq(this.num).toggleClass('open');
		});
	},
	fn_message_pop_01 : function(){
		var message_pop = new Swiper('.popup_message_04 .swiper-container', {
			loop: true,
			allowTouchMove: false,
			pagination: {
				el: '.swiper-pagination',
				type: 'fraction',
			},
			navigation: {
				nextEl: '.popup_message_04 .btn_next',
				prevEl: '.popup_message_04 .btn_prev',
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
