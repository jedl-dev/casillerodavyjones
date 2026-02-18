import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './QuizAdmin.css';

const QuizAdmin = ({ onNavigate }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    difficulty: 'Fácil'
  });

  const API_URL = 'http://localhost:5000/api/quiz';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, formData);
        alert("⚓ ¡Pregunta actualizada en los archivos de la Marina!");
      } else {
        await axios.post(API_URL, formData);
        alert("✅ ¡Nueva pregunta avistada en el horizonte!");
      }
      resetForm();
      fetchQuestions();
    } catch (err) {
      alert("💥 Error al guardar: " + err.message);
    }
  };

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

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar esta pregunta? No habrá vuelta atrás al East Blue.")) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        fetchQuestions();
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

      {/* FORMULARIO DE GESTIÓN */}
      <section className="admin-form-section">
        <h2 className="section-title">{editingId ? "📝 EDITAR PREGUNTA" : "⚔️ NUEVA PREGUNTA"}</h2>
        <form className="quiz-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Texto de la Pregunta:</label>
            <textarea 
              name="questionText" 
              value={formData.questionText} 
              onChange={handleInputChange} 
              required 
              placeholder="Ej: ¿Quién es el vicecapitán de los Sombrero de Paja?"
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
              <label>Respuesta Correcta:</label>
              <input 
                type="text" 
                name="correctAnswer" 
                value={formData.correctAnswer} 
                onChange={handleInputChange} 
                required 
                placeholder="Debe coincidir con una de las opciones"
              />
            </div>
          </div>

          <div className="options-input-grid">
            {formData.options.map((opt, i) => (
              <div key={i} className="form-group">
                <label>Opción {String.fromCharCode(65 + i)}:</label>
                <input 
                  type="text" 
                  value={opt} 
                  onChange={(e) => handleOptionChange(i, e.target.value)} 
                  required 
                />
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-pirate">{editingId ? "GUARDAR CAMBIOS" : "AÑADIR A LA BASE"}</button>
            {editingId && <button type="button" className="btn-pirate btn-outline" onClick={resetForm}>CANCELAR</button>}
          </div>
        </form>
      </section>

      <hr className="admin-divider" />

      {/* LISTADO DE PREGUNTAS */}
      <section className="admin-list-section">
        <h2 className="section-title">📦 PREGUNTAS EN LA BASE ({questions.length})</h2>
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
              {questions.map(q => (
                <tr key={q._id}>
                  <td className="td-text">{q.questionText}</td>
                  <td className={`td-diff diff-${q.difficulty.toLowerCase().replace(" ", "-")}`}>{q.difficulty}</td>
                  <td className="td-actions">
                    <button className="btn-action edit" onClick={() => handleEdit(q)}>✏️</button>
                    <button className="btn-action delete" onClick={() => handleDelete(q._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default QuizAdmin;