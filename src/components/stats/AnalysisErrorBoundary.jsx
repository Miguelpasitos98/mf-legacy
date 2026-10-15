import React from "react";
import {AlertTriangle,RotateCcw} from "lucide-react";

// Contiene excepciones del análisis sin cerrar el modal ni la página STATS.
export default class AnalysisErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error("MF LEGACY · error de análisis",error,info);}
  componentDidUpdate(prevProps){if(prevProps.resetKey!==this.props.resetKey && this.state.error)this.setState({error:null});}
  render(){
    if(!this.state.error)return this.props.children;
    return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
      <div className="flex items-center gap-2 font-black"><AlertTriangle size={18}/> No se ha podido mostrar el análisis de esta temporada</div>
      <p className="mt-2 text-xs">El informe sigue abierto y no se ha modificado ningún dato. Detalle técnico: {String(this.state.error?.message||"error inesperado")}</p>
      <button type="button" onClick={()=>this.setState({error:null})} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold"><RotateCcw size={14}/> Reintentar análisis</button>
    </div>;
  }
}
