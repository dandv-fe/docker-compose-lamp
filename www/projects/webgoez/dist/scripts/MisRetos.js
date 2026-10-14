(function (global, $) {
  'use strict';
  let loading = false;
  function load() {
    if (loading) return;
    loading = true;
    $('#own-challenges-refresh').prop('disabled', true);
    $('#own-challenges-status').removeClass('text-danger').text('Consultando tus retos y avances…');
    $('#own-challenges-list').empty();
    $.ajax({ url: './ajax/DespacharAjax.php', method: 'GET', dataType: 'json', cache: false,
      data: { action: 'own' }
    }).done(function (response) {
      if (!global.RetoCards.validOwn(response)) {
        $('#own-challenges-status').addClass('text-danger').text('La respuesta de retos está incompleta; no se mostrará un avance inventado.');
        return;
      }
      let storageWarning = '';
      response.items.forEach(challenge => {
        const $card = global.RetoCards.own(challenge);
        const key = JSON.stringify([response.employeeId, challenge.challengeId, challenge.invitationDate,
          challenge.deadline, challenge.description, challenge.incrementPercent, challenge.capitalGoal, challenge.collectionGoal]);
        $card.append(global.RetoCards.invitation(key, challenge.description, message => {
          storageWarning = message;
        }));
        $('#own-challenges-list').append($card);
      });
      $('#own-challenges-status').text(storageWarning || (response.items.length
        ? `Tus avances corresponden al cálculo actual del servidor al ${response.asOf}. Un paso a la vez.`
        : 'Todavía no tienes retos asignados. Tus permisos y tu sueldo no cambian.'));
    }).fail(function (xhr) {
      $('#own-challenges-status').addClass('text-danger').text(xhr.responseJSON && xhr.responseJSON.error ||
        'No se pudieron consultar tus retos. Verifica la conexión y vuelve a intentar.');
    }).always(function () {
      loading = false;
      $('#own-challenges-refresh').prop('disabled', false);
    });
  }
  $(function () {
    if (!$('#own-challenges').length) return;
    $('#own-challenges-refresh').on('click', load);
    load();
  });
})(window, window.jQuery);
