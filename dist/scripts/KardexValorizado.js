


$(document).ready(function () {
  $("#tblKardexValorizado").DataTable({
    "responsive": true, "lengthChange": false, "autoWidth": false,
    "buttons": ["copy", "csv", "excel", "pdf", "print"]
}).buttons().container().appendTo('#tblKardexValorizado_wrapper .col-md-6:eq(0)');

  listKardex()

  function listKardex() {

  var tabla = $('#tblKardexValorizado').dataTable();
  $.ajax({
      url: './ajax/KardexValorizadoAjax.php?op=valorizado',
      dataType: 'json',
      success: function (s) {
          tabla.fnClearTable();
          for (var i = 0; i < s.length; i++) {
              tabla.fnAddData([
                i+1,
                  s[i][0],
                  s[i][1],
                  s[i][2],
                  s[i][3],
                  s[i][4],
                  s[i][5],
                  s[i][6],
                  s[i][7],
                  s[i][8],
                  s[i][9],
                  s[i][10]
              ]);
          } // End For

      },
      error: function (e) {
          console.log(e.responseText);
      }
  });
  }
  
});