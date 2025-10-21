$('#search-input').focus(function(){
  var target = $(this);
  target.parent().addClass('active')
});
$('#search-input').blur(function(){
  var target = $(this);
  target.parent().removeClass('active')
});