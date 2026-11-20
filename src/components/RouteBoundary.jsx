import React from 'react';

// Si un trozo de ruta falla (por ejemplo, tras desplegar una versión nueva),
// el usuario ve una salida en vez de una pantalla en blanco.
class RouteBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('No se pudo cargar la ruta:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="op-page" role="alert">
        <div className="op-card">
          <h1 className="op-title-sm">No se pudo abrir esta pantalla</h1>
          <p className="op-subtitle">
            Puede que hayas abierto la web durante una actualización.
          </p>
          <div className="op-actions">
            <button className="op-btn" type="button" onClick={() => window.location.reload()}>
              Recargar
            </button>
            <a className="op-btn op-btn--ghost" href="/home">Volver al inicio</a>
          </div>
        </div>
      </div>
    );
  }
}

export default RouteBoundary;
