import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import './AddCharacter.css'; // Asegúrate de que el nombre del archivo sea exacto
import { 
  FACTIONS, ROLES, TITLES, MAJOR_CREWS, RACES, 
  FIGHTING_STYLES, DEVIL_FRUIT_CLASSES, HAKI_TYPES, ORIGINS 
} from '../constants';

const AddCharacter = ({ editData, onSuccess }) => {
  const { register, handleSubmit, watch, setValue, reset } = useForm({
    defaultValues: {
      name: '', slug: '', epithet: '', imageFile: '', bounty: 0,
      stars: 0, crowns: 0, hasNoBounty: false,
      status: 'Alive', origin: '', mainFaction: '', 
      roles: [], titles: [], crews: [], races: ['Humano'], 
      fightingStyles: [], hakiAbilities: [], 
      devilFruit: { hasFruit: false, name: '', class: '', awakened: false }
    }
  });

  const selectedFaction = watch("mainFaction");
  const noBountyFlag = watch("hasNoBounty");
  const hasFruit = watch("devilFruit.hasFruit");
  const watchedName = watch("name");

  useEffect(() => {
    if (editData) reset(editData);
  }, [editData, reset]);

  useEffect(() => {
    if (watchedName && !editData) {
      const slug = watchedName.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      setValue("slug", slug);
    }
  }, [watchedName, setValue, editData]);

  const onSubmit = async (data) => {
    try {
      const payload = { 
        ...data, 
        bounty: (noBountyFlag || selectedFaction === 'Marines') ? 0 : Number(data.bounty),
        stars: (selectedFaction === 'Marines' && !noBountyFlag) ? Number(data.stars) : 0,
        crowns: (selectedFaction === 'Marines' && !noBountyFlag) ? Number(data.crowns) : 0
      };
      
      const url = `http://localhost:5000/api/characters/${editData ? editData.slug : ''}`;
      await axios[editData ? 'put' : 'post'](url, payload);
      onSuccess();
    } catch (err) {
      alert(`Error de conexión con Atlas: ${err.message}`);
    }
  };

  // Helper para renderizar los bloques de constantes sin subdivisiones
  const RenderConstantBlock = ({ title, options, registerKey }) => (
    <>
      <h3 className="op-group-title">{title}</h3>
      <div className="op-checkbox-grid">
        {options.map((opt) => (
          <label key={opt} className="op-checkbox-label">
            <input type="checkbox" value={opt} {...register(registerKey)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </>
  );

  return (
    <div className="op-page-wrapper">
      <div className="op-card">
        <h1 className="op-main-title">{editData ? 'Editar Registro' : 'Nuevo Registro'}</h1>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          
          <section className="op-section">
            <h2 className="op-section-h2">1. Identidad</h2>
            <div className="op-grid">
              <div className="op-input-group">
                <label className="op-label">Nombre</label>
                <input {...register("name", { required: true })} className="op-input" />
              </div>
              <div className="op-input-group">
                <label className="op-label">Slug</label>
                <input {...register("slug")} readOnly className="op-input" />
              </div>
              <div className="op-input-group">
                <label className="op-label">Epíteto</label>
                <input {...register("epithet")} className="op-input" />
              </div>
              <div className="op-input-group">
                <label className="op-label">Imagen</label>
                <input {...register("imageFile")} className="op-input" placeholder="ej: luffy.png" />
              </div>
              <div className="op-input-group">
                <label className="op-label">Estado</label>
                <select {...register("status")} className="op-select">
                  <option value="Alive">Vivo</option>
                  <option value="Deceased">Muerto</option>
                  <option value="Unknown">Desconocido</option>
                </select>
              </div>
              <div className="op-input-group">
                <label className="op-label">Origen</label>
                <select {...register("origin")} className="op-select">
                  <option value="">Seleccionar...</option>
                  {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="op-section">
            <h2 className="op-section-h2">2. Economía y Facción</h2>
            <div className="op-grid">
              <div className="op-input-group">
                <label className="op-label">Facción Principal</label>
                <select {...register("mainFaction", { required: true })} className="op-select">
                  <option value="">-- Seleccionar --</option>
                  {FACTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <label className="op-checkbox-label" style={{marginTop: '30px'}}>
                <input type="checkbox" {...register("hasNoBounty")} /> ¿Sin Recompensa?
              </label>
            </div>

            {!noBountyFlag && (
              <div className="op-fruit-panel">
                {selectedFaction === 'Marines' ? (
                  <div className="op-grid">
                    <div className="op-input-group">
                      <label className="op-label">Estrellas</label>
                      <select {...register("stars")} className="op-select">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} ⭐</option>)}
                      </select>
                    </div>
                    <div className="op-input-group">
                      <label className="op-label">Coronas</label>
                      <select {...register("crowns")} className="op-select">
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} 👑</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="op-input-group">
                    <label className="op-label">Recompensa (฿)</label>
                    <input type="number" {...register("bounty")} className="op-input" />
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="op-section">
            <h2 className="op-section-h2">3. Clasificación</h2>
            <RenderConstantBlock title="Roles" options={ROLES} registerKey="roles" />
            <RenderConstantBlock title="Títulos" options={TITLES} registerKey="titles" />
            <RenderConstantBlock title="Tripulaciones" options={MAJOR_CREWS} registerKey="crews" />
            <RenderConstantBlock title="Razas" options={RACES} registerKey="races" />
          </section>

          <section className="op-section">
            <h2 className="op-section-h2">4. Combate</h2>
            <RenderConstantBlock title="Estilos de Pelea" options={FIGHTING_STYLES} registerKey="fightingStyles" />
            <RenderConstantBlock title="Hakis" options={HAKI_TYPES} registerKey="hakiAbilities" />

            <div className="op-fruit-panel">
              <label className="op-checkbox-label">
                <input type="checkbox" {...register("devilFruit.hasFruit")} /> ¿Usuario de Fruta?
              </label>
              {hasFruit && (
                <div className="op-grid" style={{marginTop: '15px'}}>
                  <div className="op-input-group">
                    <label className="op-label">Nombre</label>
                    <input {...register("devilFruit.name")} className="op-input" />
                  </div>
                  <div className="op-input-group">
                    <label className="op-label">Clase</label>
                    <select {...register("devilFruit.class")} className="op-select">
                      <option value="">-- Clase --</option>
                      {DEVIL_FRUIT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <label className="op-checkbox-label" style={{marginTop: '25px'}}>
                    <input type="checkbox" {...register("devilFruit.awakened")} /> ¿Despertada?
                  </label>
                </div>
              )}
            </div>
          </section>

          <button type="submit" className="op-btn-submit">
            {editData ? 'ACTUALIZAR' : 'REGISTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddCharacter;