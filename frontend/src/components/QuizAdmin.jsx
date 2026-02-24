import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './QuizAdmin.css';

const QuizAdmin = ({ onNavigate }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  
  // --- ESTADOS DE FILTRO Y BÚSQUEDA ---
  const [filterDifficulty, setFilterDifficulty] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState(''); 

  const [formData, setFormData] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    difficulty: 'Fácil'
  });

  const API_URL = 'http://localhost:5000/api/quiz'; // Ajusta si estás en producción
  const difficulties = ['Fácil', 'Intermedia', 'Difícil', 'Muy Difícil', 'Imposible'];

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(API_URL);
      setQuestions(res.data.data);
    } catch (err) {
      console.error("Error al obtener preguntas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  // ⚓ NUEVO: Detector de paréntesis
  const hasParenthesis = (text) => {
    return text && (text.includes('(') || text.includes(')'));
  };

  // --- LÓGICA DE FILTRADO Y BÚSQUEDA ---
  const filteredQuestions = useMemo(() => {
    let result = questions;
    if (filterDifficulty !== 'Todas') {
      result = result.filter(q => q.difficulty === filterDifficulty);
    }
    if (searchTerm) {
      result = result.filter(q => q.questionText.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return result;
  }, [questions, filterDifficulty, searchTerm]);

  // --- NAVEGACIÓN RÁPIDA ---
  const currentIndex = editingId ? filteredQuestions.findIndex(q => q._id === editingId) : -1;
  const hasNext = currentIndex !== -1 && currentIndex < filteredQuestions.length - 1;
  const hasPrev = currentIndex > 0;

  const handleEdit = (q) => {
    setEditingId(q._id);
    setFormData({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateQuestion = (direction) => {
    if (direction === 'next' && hasNext) {
      handleEdit(filteredQuestions[currentIndex + 1]);
    } else if (direction === 'prev' && hasPrev) {
      handleEdit(filteredQuestions[currentIndex - 1]);
    }
  };

  const handleSubmit = async (e, saveAndNext = false) => {
    if (e) e.preventDefault();
    
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, formData);
        
        // Actualizamos estado local sin recargar todo
        setQuestions(prev => prev.map(q => q._id === editingId ? { ...q, ...formData } : q));
        
        if (saveAndNext) {
          if (hasNext) {
            handleEdit(filteredQuestions[currentIndex + 1]);
          } else {
            alert("✅ ¡Guardado! Has llegado al final de esta lista.");
            resetForm();
          }
        } else {
          alert("⚓ ¡Pregunta actualizada!");
          resetForm();
        }
      } else {
        await axios.post(API_URL, formData);
        alert("✅ ¡Nueva pregunta avistada!");
        resetForm();
        fetchQuestions();
      }
    } catch (err) {
      alert("💥 Error al guardar: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta pregunta?")) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        setQuestions(prev => prev.filter(q => q._id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      difficulty: 'Fácil'
    });
  };

  if (loading) return <div className="admin-loading">⚓ REVISANDO EL LOG POSE...</div>;

  return (
    <div className="admin-container fade-in-page">
      <div className="admin-header">
        <h1>PANEL DE CONTROL: WANTED QUIZ</h1>
        <button className="btn-pirate btn-small" onClick={() => onNavigate('home')}>VOLVER</button>
      </div>

      <section className="admin-form-section">
        {/* Cabecera interactiva del formulario */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            {editingId ? `📝 EDITANDO PREGUNTA ${currentIndex + 1} de ${filteredQuestions.length}` : "⚔️ NUEVA PREGUNTA"}
          </h2>
          {editingId && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-pirate btn-small" 
                disabled={!hasPrev} 
                onClick={() => navigateQuestion('prev')}
                style={{ opacity: hasPrev ? 1 : 0.5, cursor: hasPrev ? 'pointer' : 'not-allowed' }}
              >
                ◀ Anterior
              </button>
              <button 
                type="button" 
                className="btn-pirate btn-small" 
                disabled={!hasNext} 
                onClick={() => navigateQuestion('next')}
                style={{ opacity: hasNext ? 1 : 0.5, cursor: hasNext ? 'pointer' : 'not-allowed' }}
              >
                Siguiente ▶
              </button>
            </div>
          )}
        </div>

        <form className="quiz-form" onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-group">
            <label>Texto de la Pregunta:</label>
            <textarea 
              name="questionText" 
              value={formData.questionText} 
              onChange={handleInputChange} 
              required 
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Dificultad:</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleInputChange}>
                {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>
                Respuesta Correcta: 
                {hasParenthesis(formData.correctAnswer) && (
                  <span style={{ color: '#e74c3c', marginLeft: '8px', fontWeight: 'bold' }}>⚠️ Paréntesis detectado</span>
                )}
              </label>
              <input 
                type="text" 
                name="correctAnswer" 
                value={formData.correctAnswer} 
                onChange={handleInputChange} 
                required 
                style={hasParenthesis(formData.correctAnswer) ? { 
                  border: '2px solid #e74c3c', 
                  backgroundColor: 'rgba(231, 76, 60, 0.1)',
                  color: '#fff'
                } : {}}
              />
            </div>
          </div>

          <div className="options-input-grid">
            {formData.options.map((opt, i) => (
              <div key={i} className="form-group">
                <label>
                  Opción {String.fromCharCode(65 + i)}:
                  {hasParenthesis(opt) && (
                    <span style={{ color: '#e74c3c', marginLeft: '8px' }}>⚠️</span>
                  )}
                </label>
                <input 
                  type="text" 
                  value={opt} 
                  onChange={(e) => handleOptionChange(i, e.target.value)} 
                  required 
                  style={hasParenthesis(opt) ? { 
                    border: '2px solid #e74c3c', 
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    color: '#fff'
                  } : {}}
                />
              </div>
            ))}
          </div>

          <div className="form-actions">
            {editingId && (
              <button 
                type="button" 
                className="btn-pirate" 
                onClick={(e) => handleSubmit(e, true)}
                style={{ background: '#27ae60', borderColor: '#2ecc71' }} 
              >
                GUARDAR Y SIGUIENTE ⏭️
              </button>
            )}
            <button type="submit" className="btn-pirate">
              {editingId ? "GUARDAR" : "AÑADIR A LA BASE"}
            </button>
            {editingId && (
              <button type="button" className="btn-pirate btn-outline" onClick={resetForm}>
                CANCELAR
              </button>
            )}
          </div>
        </form>
      </section>

      <hr className="admin-divider" />

      {/* SECCIÓN DE LISTADO */}
      <section className="admin-list-section">
        <div className="list-header-filter">
          <h2 className="section-title">
            📦 PREGUNTAS ({filteredQuestions.length} de {questions.length})
          </h2>
          
          <div className="filter-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="🔍 Buscar pregunta..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-filter-select"
              style={{ width: '220px' }}
            />
            <select 
              value={filterDifficulty} 
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="admin-filter-select"
            >
              <option value="Todas">Todas las dificultades</option>
              {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Texto</th>
                <th>Dificultad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map(q => (
                <tr key={q._id} style={editingId === q._id ? { background: 'rgba(217, 27, 27, 0.15)' } : {}}>
                  <td className="td-text">{q.questionText}</td>
                  <td className={`td-diff diff-${q.difficulty.toLowerCase().replace(" ", "-")}`}>
                    {q.difficulty}
                  </td>
                  <td className="td-actions">
                    <button className="btn-action edit" onClick={() => handleEdit(q)}>✏️</button>
                    <button className="btn-action delete" onClick={() => handleDelete(q._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>
                    No se encontraron preguntas en esta búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default QuizAdmin;