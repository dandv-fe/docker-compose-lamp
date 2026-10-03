var i = 0;
let trae
let cont
function timedCount() {
  i = i + 1;
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
     // document.getElementById("txtHint").innerHTML = ;
     trae=parseInt(this.responseText)
     if ( cont=== undefined) {
      cont=trae
     }
     if (trae!=cont) {
      cont=trae
        postMessage(trae);
     }
      
      setTimeout("timedCount()",5000);
    }
  };
  xmlhttp.open("GET", "../../../ajax/UsuarioAjax.php", true);
  xmlhttp.send();
 
  //postMessage(i);



 
}

timedCount();




