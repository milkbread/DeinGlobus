require(['jQuery', 'boostrap'], function($){

	var signup = function(e) {
		e.preventDefault();
		$('.alert-danger').removeClass('alert-danger');
		$('.error').remove();
		$.ajax({
    	    url: "jsignup",
    	    data: $(this).serialize(),
    	    method: 'POST',
    	    dataType: 'JSON',
		}).done(function(r) {
			if (r.errors) {
				$.each(r.errors, function(d) {
					$('input[name=' + d + ']').addClass('alert-danger');
					r.errors[d].forEach(function(d2) {
						var span = $('<span>');
						span.addClass('error')
						span.text(d2);
						$('input[name=' + d + ']').next('div').append(span);
					});
				});				
			} else if (r.response.status === 'success') {
				
			}
		});
	};

	$( document ).ready(function() {
		$(document).on('submit', '#signup form', signup);
	});

	console.log('main.js loaded');
});