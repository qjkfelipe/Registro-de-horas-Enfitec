import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoEnfitecFull from '../assets/logo-enfitec-full.jpg'
import { getMembro, trocarSenha, logout } from '../lib/api'

// Avalia a senha: verifica os requisitos obrigatórios e classifica a força.
// Só é considerada "forte" quando cumpre TODOS os requisitos
// (tamanho + letra maiúscula + número + caractere especial).
function avaliarSenha(s) {
  const criterios = {
    tamanho: s.length >= 8,
    maiuscula: /[A-Z]/.test(s),
    numero: /[0-9]/.test(s),
    especial: /[^A-Za-z0-9]/.test(s),
  }
  const atendidos = Object.values(criterios).filter(Boolean).length
  const forte = criterios.tamanho && criterios.maiuscula && criterios.numero && criterios.especial

  let nivel, rotulo, segmentos
  if (s.length === 0) {
    nivel = 'vazia'; rotulo = ''; segmentos = 0
  } else if (forte) {
    nivel = 'forte'; rotulo = 'Senha forte'; segmentos = 3
  } else if (atendidos >= 2) {
    nivel = 'media'; rotulo = 'Senha média'; segmentos = 2
  } else {
    nivel = 'fraca'; rotulo = 'Senha fraca'; segmentos = 1
  }
  return { criterios, nivel, rotulo, segmentos, forte }
}

const REQUISITOS = [
  ['tamanho', 'Ao menos 8 caracteres'],
  ['maiuscula', 'Uma letra maiúscula'],
  ['numero', 'Um número'],
  ['especial', 'Um caractere especial (!@#$…)'],
]

export default function TrocarSenha() {
  const navigate = useNavigate()
  const membro = getMembro()
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const avaliacao = avaliarSenha(nova)
  const coincidem = confirma.length > 0 && nova === confirma
  // Só libera a criação se a senha for forte (cumpre os 3 parâmetros + tamanho) e as duas coincidirem.
  const podeSalvar = avaliacao.forte && coincidem && !carregando

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!avaliacao.forte) {
      setErro('A senha precisa ser forte: letra maiúscula, número e caractere especial.')
      return
    }
    if (nova !== confirma) {
      setErro('As senhas não coincidem.')
      return
    }
    setCarregando(true)
    try {
      await trocarSenha(nova)
      navigate(membro?.role === 'gestor' ? '/gestao' : '/registro', { replace: true })
    } catch (err) {
      setErro(err?.message || 'Não foi possível trocar a senha.')
    } finally {
      setCarregando(false)
    }
  }

  function sair() {
    logout()
    navigate('/')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand brand--center">
          <img src={logoEnfitecFull} alt="ENFITEC Jr." className="brand-logo-full" />
        </div>

        <h2 className="auth-title">Crie sua senha</h2>
        <p className="auth-desc">
          Este é seu primeiro acesso. Defina uma senha pessoal forte para continuar.
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span className="field-label">Nova senha</span>
            <input type="password" required className="input" autoFocus
              placeholder="letra maiúscula, número e símbolo"
              value={nova} onChange={(e) => setNova(e.target.value)} />
          </label>

          {/* Medidor de força + checklist de requisitos */}
          {nova.length > 0 && (
            <div className={`forca forca--${avaliacao.nivel}`}>
              <div className="forca-barras" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`forca-seg ${i < avaliacao.segmentos ? 'on' : ''}`} />
                ))}
              </div>
              <span className="forca-rotulo" role="status">{avaliacao.rotulo}</span>
            </div>
          )}

          <ul className="requisitos">
            {REQUISITOS.map(([chave, texto]) => {
              const ok = avaliacao.criterios[chave]
              return (
                <li key={chave} className={ok ? 'ok' : ''}>
                  <span className="req-marca" aria-hidden="true">{ok ? '✓' : ''}</span>
                  {texto}
                </li>
              )
            })}
          </ul>

          <label className="field">
            <span className="field-label">Confirmar nova senha</span>
            <input type="password" required className="input"
              placeholder="repita a senha"
              value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </label>
          {confirma.length > 0 && !coincidem && (
            <p className="auth-erro">As senhas não coincidem.</p>
          )}

          {erro && <p className="auth-erro">{erro}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={!podeSalvar}>
            {carregando ? 'Salvando...' : 'Salvar e entrar'}
          </button>
        </form>

        <button className="auth-alt" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
