addEventListener('message', recibidoSumaRecaudoCreditos, false);
function recibidoSumaRecaudoCreditos(e){

    let valores = Object.values(e.data);
    const sumaInfo={
        recaudo: 0,
        creditos: 0,
        seguros: 0,
        cartera: 0,
        cantidadAbonos: 0
    }
for(let i=0; i< valores.length; i++){
      const tarjeta=valores[i]
    if (tarjeta.estado==='created' || tarjeta.estado==='entregando' ) {
        sumaInfo.seguros+=parseFloat(tarjeta.ut_adi_valor)
        sumaInfo.creditos+=parseFloat(tarjeta.costo)
    }
  sumaInfo.recaudo+=parseFloat(tarjeta.recaudo)*-1
  sumaInfo.cartera+=parseFloat(tarjeta.resta)
  if (parseFloat(tarjeta.recaudo)*-1>0) {
    sumaInfo.cantidadAbonos++;
  }
}

    postMessage(sumaInfo)
   

 //   postMessage('ee');
}


