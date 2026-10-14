// Plan de escritura: agrupar altas en bloques pequeños y mantener ediciones separadas.
// No realiza llamadas a Base44 y permite probar que un historial amplio no se envía fila a fila.
export function planHistoricalActions(queue, chunkSize = 10) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 25) throw Error("Tamaño de grupo no válido.");
  const actions = [];
  for (const type of ["valuation", "team"]) {
    const news = queue.filter(item => item.type === type && item.status === "new");
    for (let index = 0; index < news.length; index += chunkSize)
      actions.push({ type, action: "create", items: news.slice(index, index + chunkSize) });
  }
  for (const item of queue.filter(item => item.status === "update"))
    actions.push({ type: item.type, action: "update", items: [item] });
  return actions;
}
