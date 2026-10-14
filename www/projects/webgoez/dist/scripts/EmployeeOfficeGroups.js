(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EmployeeOfficeGroups = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function options($) {
    return {
      orderFixed: { pre: [[9, 'asc'], [10, 'asc']] },
      order: [[1, 'asc']],
      columnDefs: [
        { targets: 9, render: $.fn.dataTable.render.text() },
        { targets: 10, visible: false, searchable: false }
      ],
      rowGroup: {
        dataSrc: 10,
        startRender: function (rows) {
          return $('<span>').text(`${rows.data()[0][9]} · ${rows.count()} ${rows.count() === 1 ? 'empleado' : 'empleados'} en esta página`);
        }
      },
      initComplete: function () {
        const api = this.api();
        function adjustGroups() {
          const responsive = api.columns().responsiveHidden().toArray();
          const visible = api.columns().visible().toArray();
          const count = visible.filter((value, index) => value && responsive[index] !== false).length;
          $(api.table().body()).find('tr.dtrg-group td').attr('colspan', Math.max(1, count))
            .css({ whiteSpace: 'normal', overflowWrap: 'anywhere' });
        }
        api.on('draw.dt.officeGroups responsive-resize.dt.officeGroups column-visibility.dt.officeGroups', adjustGroups);
        adjustGroups();
      }
    };
  }
  return { options };
});
