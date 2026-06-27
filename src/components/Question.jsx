import React, { useState, useEffect, memo } from 'react';

const Question = memo(({
  id,
  type,
  onChange,
  initialStatement = '',
  initialOptions = null,
}) => {
  const [statement, setStatement] = useState(initialStatement);
  const [choices, setChoices] = useState(() =>
    initialOptions && initialOptions.length > 0
      ? initialOptions.map(value => ({ id: crypto.randomUUID(), value }))
      : []
  );

  useEffect(() => {
    const data = { statement, type };
    if (type === 'unique_choice') {
      data.options = choices.map(c => c.value);
    }
    onChange(id, data);
  }, [statement, choices, id, type, onChange]);

  const handleChoiceChange = (choiceId, value) => {
    setChoices(prev => prev.map(c => c.id === choiceId ? { ...c, value } : c));
  };

  const handleAddChoice = () => {
    setChoices(prev => [...prev, { id: crypto.randomUUID(), value: '' }]);
  };

  const handleRemoveChoice = (choiceId) => {
    setChoices(prev => prev.filter(c => c.id !== choiceId));
  };

  return (
    <div className="question-builder">
      <label className="question-builder-label" htmlFor={`input-${id}`}>
        Enunciado de la pregunta
      </label>
      <input
        id={`input-${id}`}
        className="question-statement-input"
        type="text"
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="Escribe tu pregunta aquí..."
      />

      {type === 'unique_choice' && (
        <div className="question-options">
          <span className="question-options-title">Opciones de respuesta</span>

          {choices.length === 0 ? (
            <p className="question-options-empty">
              Aún no has agregado opciones. Añade al menos dos.
            </p>
          ) : (
            <div className="question-options-list">
              {choices.map((choice, index) => (
                <div className="option-row" key={choice.id}>
                  <span className="option-index">{index + 1}</span>
                  <input
                    className="option-input"
                    value={choice.value}
                    onChange={(e) => handleChoiceChange(choice.id, e.target.value)}
                    placeholder={`Opción ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="option-remove-btn"
                    onClick={() => handleRemoveChoice(choice.id)}
                    aria-label={`Eliminar opción ${index + 1}`}
                    title="Eliminar opción"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="add-option-btn" onClick={handleAddChoice}>
            + Agregar opción
          </button>
        </div>
      )}
    </div>
  );
});

export default Question;
