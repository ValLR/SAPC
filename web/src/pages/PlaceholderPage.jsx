import React from 'react';
import './PlaceholderPage.css';

/**
 * Vista genérica para secciones secundarias del portal (US-08, US-12, US-14, US-17)
 */
export const PlaceholderPage = ({ title, description, code }) => {
  return (
    <div className="placeholder-container">
      <div className="placeholder-card">
        <span className="placeholder-code">{code}</span>
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-description">{description}</p>
        <div className="placeholder-badge">
          <span>Ruta Protegida por AuthContext</span>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
