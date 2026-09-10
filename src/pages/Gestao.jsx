import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoEnfitecFull from '../assets/logo-enfitec-full.jpg'
import {
  getMembro, logout, resumoGestao, analiseGestao, registrosGestao, totalMembros,
  listarMembros, salvarMembro, definirAtivoMembro,
} from '../lib/api'

// "2026-08-19" -> "19/08"
function formatarData(iso) {
  const [, mes, dia] = String(iso).split('-')
  return `${dia}/${mes}`
}

// Desenha um gráfico de barras horizontais dentro do PDF (jsPDF). Retorna o novo Y.
function desenharBarrasPDF(doc, titulo, dados, y) {
  if (y > 250) { doc.addPage(); y = 20 }
  doc.setFontSize(13); doc.setTextColor(10, 44, 84)
  doc.text(titulo, 14, y); y += 7
  const max = Math.max(...dados.map((d) => d.total_minutos), 1)
  const soma = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const larguraTotal = 182
  doc.setFontSize(9)
  for (const d of dados) {
    if (y > 282) { doc.addPage(); y = 20 }
    doc.setTextColor(40, 40, 40)
    doc.text(String(d.rotulo), 14, y)
    doc.text(`${formatarMinutos(d.total_minutos)}  ${Math.round((d.total_minutos / soma) * 100)}%`, 196, y, { align: 'right' })
    y += 2
    doc.setFillColor(231, 238, 247); doc.rect(14, y, larguraTotal, 2.5, 'F')
    doc.setFillColor(10, 44, 84); doc.rect(14, y, larguraTotal * (d.total_minutos / max), 2.5, 'F')
    y += 8
  }
  return y + 2
}

// Gráfico de colunas (barras verticais) no PDF.
function desenharColunasPDF(doc, titulo, dados, y) {
  if (y > 225) { doc.addPage(); y = 20 }
  doc.setFontSize(13); doc.setTextColor(10, 44, 84); doc.text(titulo, 14, y); y += 6
  const max = Math.max(...dados.map((d) => d.total_minutos), 1)
  const soma = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const left = 16, fullW = 180, top = y + 6, base = y + 44
  const n = dados.length, step = fullW / n, bw = Math.min(step * 0.5, 22)
  doc.setDrawColor(210); doc.line(left, base, left + fullW, base)
  dados.forEach((d, i) => {
    const cx = left + step * i + step / 2
    const bh = (d.total_minutos / max) * (base - top)
    doc.setFillColor(10, 44, 84); doc.rect(cx - bw / 2, base - bh, bw, bh, 'F')
    doc.setFontSize(6.5); doc.setTextColor(40, 40, 40)
    doc.text(`${formatarMinutos(d.total_minutos)} ${Math.round((d.total_minutos / soma) * 100)}%`, cx, base - bh - 1.5, { align: 'center' })
    doc.text(truncar(d.rotulo, 16), cx, base + 4, { align: 'center' })
  })
  return base + 10
}

// Gráfico de linhas no PDF.
function desenharLinhasPDF(doc, titulo, dados, y) {
  if (y > 225) { doc.addPage(); y = 20 }
  doc.setFontSize(13); doc.setTextColor(10, 44, 84); doc.text(titulo, 14, y); y += 6
  const max = Math.max(...dados.map((d) => d.total_minutos), 1)
  const soma = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const left = 22, fullW = 168, top = y + 6, base = y + 44
  const n = dados.length
  const px = (i) => (n === 1 ? left + fullW / 2 : left + (fullW / (n - 1)) * i)
  const py = (v) => base - (v / max) * (base - top)
  doc.setDrawColor(210); doc.line(left - 4, base, left + fullW + 4, base)
  doc.setDrawColor(10, 44, 84); doc.setLineWidth(0.7)
  for (let i = 0; i < n - 1; i++) {
    doc.line(px(i), py(dados[i].total_minutos), px(i + 1), py(dados[i + 1].total_minutos))
  }
  doc.setLineWidth(0.2)
  dados.forEach((d, i) => {
    const x = px(i), yv = py(d.total_minutos)
    doc.setFillColor(10, 44, 84); doc.circle(x, yv, 1.1, 'F')
    doc.setFontSize(6.5); doc.setTextColor(40, 40, 40)
    doc.text(`${formatarMinutos(d.total_minutos)} ${Math.round((d.total_minutos / soma) * 100)}%`, x, yv - 2.5, { align: 'center' })
    doc.text(truncar(d.rotulo, 16), x, base + 4, { align: 'center' })
  })
  return base + 10
}

// Gráfico de pizza no PDF (fatias + legenda ao lado).
function desenharPizzaPDF(doc, titulo, dados, y) {
  if (y > 210) { doc.addPage(); y = 20 }
  doc.setFontSize(13); doc.setTextColor(10, 44, 84); doc.text(titulo, 14, y); y += 8
  const soma = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const cx = 38, cy = y + 26, R = 24
  let ang = -Math.PI / 2
  dados.forEach((d, i) => {
    const fatia = (d.total_minutos / soma) * 2 * Math.PI
    const passos = Math.max(2, Math.ceil(fatia / 0.15))
    const [r, g, b] = CORES_PIZZA_RGB[i % CORES_PIZZA_RGB.length]
    doc.setFillColor(r, g, b)
    for (let s = 0; s < passos; s++) {
      const a0 = ang + fatia * (s / passos), a1 = ang + fatia * ((s + 1) / passos)
      doc.triangle(cx, cy, cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1), 'F')
    }
    ang += fatia
  })
  let ly = y + 4
  doc.setFontSize(9)
  dados.forEach((d, i) => {
    const [r, g, b] = CORES_PIZZA_RGB[i % CORES_PIZZA_RGB.length]
    doc.setFillColor(r, g, b); doc.rect(74, ly - 3, 4, 4, 'F')
    doc.setTextColor(40, 40, 40)
    doc.text(`${truncar(d.rotulo, 30)}   ${formatarMinutos(d.total_minutos)} · ${Math.round((d.total_minutos / soma) * 100)}%`, 80, ly)
    ly += 7
  })
  return Math.max(cy + R, ly) + 6
}

// Cores das fatias da pizza (família azul-marinho, do escuro ao claro).
const CORES_PIZZA = ['#0a2c54', '#1a4b82', '#2f6fb0', '#4f8bcb', '#7aa9dd', '#a9c7ea', '#c9dcf1']
const CORES_PIZZA_RGB = [
  [10, 44, 84], [26, 75, 130], [47, 111, 176], [79, 139, 203],
  [122, 169, 221], [169, 199, 234], [201, 220, 241],
]
const truncar = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '.' : String(s))

const pct = (v, total) => (total ? Math.round((v / total) * 100) : 0)

// Gráfico de barras horizontais (magnitude) com valor e porcentagem.
function GraficoBarras({ dados, vazio }) {
  if (!dados || dados.length === 0) {
    return <div className="empty"><p>{vazio}</p></div>
  }
  const max = Math.max(...dados.map((d) => d.total_minutos)) || 1
  const total = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  return (
    <ul className="grafico" role="list">
      {dados.map((d) => (
        <li key={d.rotulo} className="grafico-linha">
          <div className="grafico-topo">
            <span>{d.rotulo}</span>
            <span className="valor">{formatarMinutos(d.total_minutos)} · {pct(d.total_minutos, total)}%</span>
          </div>
          <div className="grafico-trilho">
            <div className="grafico-barra"
              style={{ width: `${(d.total_minutos / max) * 100}%` }}
              title={`${d.rotulo}: ${formatarMinutos(d.total_minutos)}`} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Gráfico de pizza (rosca) com legenda mostrando valor e porcentagem.
function GraficoPizza({ dados, vazio }) {
  if (!dados || dados.length === 0) {
    return <div className="empty"><p>{vazio}</p></div>
  }
  const total = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const size = 168, stroke = 32, r = (size - stroke) / 2, c = size / 2, C = 2 * Math.PI * r
  let acumulado = 0
  return (
    <div className="pizza-wrap">
      <svg className="pizza-svg" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {dados.map((d, i) => {
          const frac = d.total_minutos / total
          const dash = Math.max(frac * C - 2, 0) // 2px de respiro entre fatias
          const el = (
            <circle key={i} cx={c} cy={c} r={r} fill="none"
              stroke={CORES_PIZZA[i % CORES_PIZZA.length]} strokeWidth={stroke}
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acumulado}
              transform={`rotate(-90 ${c} ${c})`}>
              <title>{`${d.rotulo}: ${formatarMinutos(d.total_minutos)} (${pct(d.total_minutos, total)}%)`}</title>
            </circle>
          )
          acumulado += frac * C
          return el
        })}
      </svg>
      <ul className="pizza-legenda">
        {dados.map((d, i) => (
          <li key={d.rotulo}>
            <span className="pizza-cor" style={{ background: CORES_PIZZA[i % CORES_PIZZA.length] }} />
            <span className="pizza-rot">{d.rotulo}</span>
            <span className="pizza-val">{formatarMinutos(d.total_minutos)} · {pct(d.total_minutos, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Gráfico de colunas (barras verticais) com valor no topo e porcentagem.
function GraficoColunas({ dados, vazio }) {
  if (!dados || dados.length === 0) {
    return <div className="empty"><p>{vazio}</p></div>
  }
  const total = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const max = Math.max(...dados.map((d) => d.total_minutos), 1)
  const W = 600, base = 190, top = 26, left = 8, right = 8
  const step = (W - left - right) / dados.length
  const bw = Math.min(step * 0.6, 64)
  return (
    <div className="svg-chart-wrap">
      <svg viewBox={`0 0 ${W} 250`} className="svg-chart" preserveAspectRatio="xMidYMid meet">
        <line x1={left} y1={base} x2={W - right} y2={base} stroke="var(--border)" strokeWidth="1" />
        {dados.map((d, i) => {
          const cx = left + step * i + step / 2
          const bh = (d.total_minutos / max) * (base - top)
          const y = base - bh
          return (
            <g key={d.rotulo}>
              <rect x={cx - bw / 2} y={y} width={bw} height={bh} rx="3" fill="var(--brand)">
                <title>{`${d.rotulo}: ${formatarMinutos(d.total_minutos)} (${pct(d.total_minutos, total)}%)`}</title>
              </rect>
              <text x={cx} y={y - 5} textAnchor="middle" className="svg-valor">
                {formatarMinutos(d.total_minutos)} · {pct(d.total_minutos, total)}%
              </text>
              <text x={cx} y={base + 12} textAnchor="end" className="svg-rot"
                transform={`rotate(-28 ${cx} ${base + 12})`}>{d.rotulo}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Gráfico de linhas com pontos, valor e porcentagem.
function GraficoLinhas({ dados, vazio }) {
  if (!dados || dados.length === 0) {
    return <div className="empty"><p>{vazio}</p></div>
  }
  const total = dados.reduce((s, d) => s + d.total_minutos, 0) || 1
  const max = Math.max(...dados.map((d) => d.total_minutos), 1)
  const W = 600, base = 190, top = 26, left = 24, right = 24
  const n = dados.length
  const px = (i) => (n === 1 ? W / 2 : left + ((W - left - right) / (n - 1)) * i)
  const py = (v) => base - (v / max) * (base - top)
  const pontos = dados.map((d, i) => ({ x: px(i), y: py(d.total_minutos), d }))
  const linha = pontos.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <div className="svg-chart-wrap">
      <svg viewBox={`0 0 ${W} 250`} className="svg-chart" preserveAspectRatio="xMidYMid meet">
        <line x1={left} y1={base} x2={W - right} y2={base} stroke="var(--border)" strokeWidth="1" />
        <polyline points={linha} fill="none" stroke="var(--brand)" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {pontos.map((p) => (
          <g key={p.d.rotulo}>
            <circle cx={p.x} cy={p.y} r="4.5" fill="var(--brand)">
              <title>{`${p.d.rotulo}: ${formatarMinutos(p.d.total_minutos)} (${pct(p.d.total_minutos, total)}%)`}</title>
            </circle>
            <text x={p.x} y={p.y - 9} textAnchor="middle" className="svg-valor">
              {formatarMinutos(p.d.total_minutos)} · {pct(p.d.total_minutos, total)}%
            </text>
            <text x={p.x} y={base + 12} textAnchor="end" className="svg-rot"
              transform={`rotate(-28 ${p.x} ${base + 12})`}>{p.d.rotulo}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ---- helpers de tempo/mês ----
function formatarMinutos(total) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
const SETORES = [
  'Presidência',
  'Administrativo-Financeiro',
  'Comercial',
  'Projetos',
  'Gestão de Pessoas',
  'Marketing',
]
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const mesAtual = () => new Date().toISOString().slice(0, 7)
function rotuloMes(ym) {
  const [ano, mes] = ym.split('-').map(Number)
  return `${MESES[mes - 1]}/${ano}`
}
function deslocarMes(ym, delta) {
  const [ano, mes] = ym.split('-').map(Number)
  const d = new Date(ano, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Gestao() {
  const navigate = useNavigate()
  const conta = getMembro()

  const [mesView, setMesView] = useState(mesAtual())
  const podeAvancar = mesView < mesAtual()
  const [setorView, setSetorView] = useState('') // '' = todos os setores
  const [tipoGrafico, setTipoGrafico] = useState('barras') // 'barras' | 'colunas' | 'linhas' | 'pizza'
  const [verTodos, setVerTodos] = useState(false) // lançamentos detalhados: 5 ou todos
  const [verTodosTotais, setVerTodosTotais] = useState(false) // horas totais por membro: 5 ou todos
  const [resumo, setResumo] = useState([])
  const [analise, setAnalise] = useState({ por_setor: [], por_atividade: [] })
  const [lancamentos, setLancamentos] = useState([])
  const [totais, setTotais] = useState([]) // horas totais por membro (desde o início)
  const [membros, setMembros] = useState([])
  const [novo, setNovo] = useState({ email: '', nome: '', senha: '', role: 'membro' })

  const [toast, setToast] = useState('')
  const toastTimer = useRef()
  function notificar(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  function carregarMembros() {
    listarMembros().then(setMembros).catch(() => notificar('Erro ao carregar membros'))
  }

  useEffect(() => { carregarMembros() }, [])
  useEffect(() => {
    // Horas totais por membro respeita o setor (mas não o mês — é "desde o início").
    totalMembros(setorView).then(setTotais).catch(() => notificar('Erro ao carregar totais'))
    setVerTodosTotais(false)
  }, [setorView])
  useEffect(() => {
    resumoGestao(mesView, setorView).then(setResumo).catch(() => notificar('Erro ao carregar horas'))
    analiseGestao(mesView, setorView).then(setAnalise).catch(() => notificar('Erro ao carregar análise'))
    registrosGestao(mesView, setorView).then(setLancamentos).catch(() => notificar('Erro ao carregar lançamentos'))
    setVerTodos(false)
  }, [mesView, setorView])

  const topSetor = analise.por_setor[0]
  const topAtividade = analise.por_atividade[0]
  const Grafico = tipoGrafico === 'pizza' ? GraficoPizza
    : tipoGrafico === 'colunas' ? GraficoColunas
      : tipoGrafico === 'linhas' ? GraficoLinhas
        : GraficoBarras

  // Agrega o resumo (por membro+setor) em uma linha por membro.
  const { porMembro, totalGeral } = useMemo(() => {
    const mapa = {}
    for (const l of resumo) {
      if (!mapa[l.nome]) mapa[l.nome] = { nome: l.nome, total: 0, qtd: 0, setores: [] }
      mapa[l.nome].total += l.total_minutos
      mapa[l.nome].qtd += l.qtd
      if (!mapa[l.nome].setores.includes(l.setor)) mapa[l.nome].setores.push(l.setor)
    }
    const porMembro = Object.values(mapa).sort((a, b) => b.total - a.total)
    const totalGeral = porMembro.reduce((s, m) => s + m.total, 0)
    return { porMembro, totalGeral }
  }, [resumo])

  async function adicionarMembro(e) {
    e.preventDefault()
    try {
      await salvarMembro(novo)
      setNovo({ email: '', nome: '', senha: '', role: 'membro' })
      carregarMembros()
      notificar('Membro salvo ✓')
    } catch (err) {
      alert(err?.message || 'Não foi possível salvar. Verifique os dados.')
    }
  }

  async function alternarAtivo(m) {
    try {
      await definirAtivoMembro(m.id, !m.ativo)
      carregarMembros()
      notificar(m.ativo ? 'Acesso desativado' : 'Acesso ativado')
    } catch {
      alert('Não foi possível atualizar o acesso.')
    }
  }

  function baixarPDF() {
    const setorLabel = setorView || 'Todos os setores'
    const doc = new jsPDF()

    // Cabeçalho
    doc.setFontSize(16); doc.setTextColor(10, 44, 84)
    doc.text('ENFITEC Junior - Relatorio de Horas', 14, 20)
    doc.setFontSize(11); doc.setTextColor(40, 40, 40)
    doc.text(`Mes: ${rotuloMes(mesView)}`, 14, 28)
    doc.text(`Setor: ${setorLabel}`, 14, 34)
    doc.text(`Total geral: ${formatarMinutos(totalGeral)}`, 14, 40)

    // Destaques da análise (o de setor só aparece quando não há filtro de setor)
    if (setorView === '') {
      doc.text(`Setor com mais horas: ${topSetor ? `${topSetor.rotulo} (${formatarMinutos(topSetor.total_minutos)})` : '-'}`, 14, 47)
    }
    doc.text(`Atividade mais trabalhada: ${topAtividade ? `${topAtividade.rotulo} (${formatarMinutos(topAtividade.total_minutos)})` : '-'}`, 14, 53)

    const estilo = { styles: { fontSize: 10 }, headStyles: { fillColor: [10, 44, 84] } }

    // Tabela: horas por membro
    autoTable(doc, {
      startY: 60,
      head: [['Membro', 'Setores', 'Lancamentos', 'Horas']],
      body: porMembro.map((m) => [m.nome, m.setores.join(', '), String(m.qtd), formatarMinutos(m.total)]),
      ...estilo,
    })

    // Análise em gráficos (barras) — "Horas por setor" só quando vendo todos
    let y = doc.lastAutoTable.finalY + 12
    // Usa o mesmo formato que o usuário está visualizando na tela.
    const desenhaAnalise = tipoGrafico === 'colunas' ? desenharColunasPDF
      : tipoGrafico === 'linhas' ? desenharLinhasPDF
        : tipoGrafico === 'pizza' ? desenharPizzaPDF
          : desenharBarrasPDF
    if (setorView === '') {
      y = desenhaAnalise(doc, 'Horas por setor', analise.por_setor, y)
    }
    y = desenhaAnalise(doc, 'Horas por atividade', analise.por_atividade, y)

    // Lançamentos detalhados (com descrição)
    if (lancamentos.length > 0) {
      if (y > 250) { doc.addPage(); y = 20 }
      doc.setFontSize(13); doc.setTextColor(10, 44, 84)
      doc.text('Lançamentos detalhados', 14, y)
      autoTable(doc, {
        startY: y + 3,
        head: [['Data', 'Membro', 'Setor', 'Atividade', 'Horas', 'Descrição']],
        body: lancamentos.map((l) => [
          formatarData(l.data), l.nome, l.setor, l.atividade,
          formatarMinutos(l.minutos), l.descricao || '-',
        ]),
        styles: { fontSize: 9, cellWidth: 'wrap' },
        headStyles: { fillColor: [10, 44, 84] },
        columnStyles: { 5: { cellWidth: 60 } },
      })
    }

    // Horas totais por membro (desde o início — não depende do mês/setor)
    if (totais.length > 0) {
      y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : y
      if (y > 250) { doc.addPage(); y = 20 }
      doc.setFontSize(13); doc.setTextColor(10, 44, 84)
      doc.text('Horas totais por membro (desde o início)', 14, y)
      autoTable(doc, {
        startY: y + 3,
        head: [['Membro', 'Lancamentos', 'Horas totais']],
        body: totais.map((t) => [t.nome, String(t.qtd), formatarMinutos(t.total_minutos)]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [10, 44, 84] },
      })
    }

    const slug = setorView ? '-' + setorView.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-') : ''
    doc.save(`relatorio-horas-${mesView}${slug}.pdf`)
  }

  function baixarCSV() {
    const sep = ';'
    const esc = (v) => {
      let s = String(v ?? '')
      // Anti-injeção de fórmula (CSV injection): células iniciadas por = + - @ (ou tab/CR)
      // são executadas como fórmula pelo Excel/Sheets. Prefixa com aspa simples p/ virar texto.
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const dataBR = (iso) => String(iso).split('-').reverse().join('/')
    const linhas = [
      ['Data', 'Membro', 'Setor', 'Atividade', 'Horas', 'Minutos', 'Descrição'],
      ...lancamentos.map((l) => [
        dataBR(l.data), l.nome, l.setor, l.atividade,
        formatarMinutos(l.minutos), l.minutos, l.descricao || '',
      ]),
    ]
    // ﻿ (BOM) para o Excel reconhecer o UTF-8 e exibir os acentos corretamente.
    const csv = '﻿' + linhas.map((l) => l.map(esc).join(sep)).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const slug = setorView ? '-' + setorView.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-') : ''
    const a = document.createElement('a')
    a.href = url
    a.download = `resumo-horas-${mesView}${slug}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function sair() {
    logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <img src={logoEnfitecFull} alt="ENFITEC Jr." className="topbar-logo-full" />
        </div>
        <div className="topbar-user">
          <div className="avatar" aria-hidden="true">GP</div>
          <div className="topbar-userinfo">
            <span className="topbar-name">Gestão de Pessoas</span>
            <span className="topbar-email">{conta?.email}</span>
          </div>
          <button className="btn btn-ghost" onClick={sair}>Sair</button>
        </div>
      </header>

      <main className="content">
        <h1 className="saudacao">Painel de Gestão</h1>

        {/* Filtro por setor — controla tabela, gráficos e PDF */}
        <div className="filtro-setor" role="group" aria-label="Filtrar por setor">
          <button className={`filtro-pill ${setorView === '' ? 'ativo' : ''}`}
            onClick={() => setSetorView('')}>Todos</button>
          {SETORES.map((s) => (
            <button key={s} className={`filtro-pill ${setorView === s ? 'ativo' : ''}`}
              onClick={() => setSetorView(s)}>{s}</button>
          ))}
        </div>

        {/* Relatório de horas */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Horas da equipe</h2>
              <p className="panel-sub">Relatório mensal · somente leitura</p>
            </div>
            <div className="mes-nav mes-nav--claro">
              <button className="mes-btn mes-btn--claro" onClick={() => setMesView((m) => deslocarMes(m, -1))}
                aria-label="Mês anterior">‹</button>
              <span className="mes-rotulo">{rotuloMes(mesView)}</span>
              <button className="mes-btn mes-btn--claro" onClick={() => setMesView((m) => deslocarMes(m, 1))}
                disabled={!podeAvancar} aria-label="Próximo mês">›</button>
            </div>
          </div>

          <div className="relatorio-head">
            <div className="total">
              <span className="total-label">Total geral</span>
              <span className="total-value">{formatarMinutos(totalGeral)}</span>
              <span className="total-sub">{lancamentos.length} lançamento(s)</span>
            </div>
            <div className="export-botoes">
              <button className="btn btn-primary" onClick={baixarPDF} disabled={porMembro.length === 0}>
                ⬇ PDF
              </button>
              <button className="btn btn-ghost" onClick={baixarCSV} disabled={lancamentos.length === 0}>
                ⬇ CSV
              </button>
            </div>
          </div>
        </section>

        {/* Análise em gráficos */}
        <div className="stats">
          {setorView === '' ? (
            <div className="stat-card stat-card--brand">
              <span className="stat-label">Setor com mais horas</span>
              <span className="stat-value">{topSetor ? formatarMinutos(topSetor.total_minutos) : '0:00'}</span>
              <span className="stat-hint">{topSetor ? topSetor.rotulo : '—'}</span>
            </div>
          ) : (
            <div className="stat-card stat-card--brand">
              <span className="stat-label">Total do setor</span>
              <span className="stat-value">{formatarMinutos(totalGeral)}</span>
              <span className="stat-hint">{setorView}</span>
            </div>
          )}
          <div className="stat-card stat-card--brand">
            <span className="stat-label">Atividade mais trabalhada</span>
            <span className="stat-value">{topAtividade ? formatarMinutos(topAtividade.total_minutos) : '0:00'}</span>
            <span className="stat-hint">{topAtividade ? topAtividade.rotulo : '—'}</span>
          </div>
        </div>

        {/* Seletor de visualização dos gráficos de análise */}
        <div className="viz-toggle" role="group" aria-label="Formato dos gráficos">
          <span className="viz-label">Visualização:</span>
          <button className={tipoGrafico === 'barras' ? 'ativo' : ''}
            onClick={() => setTipoGrafico('barras')}>Barras</button>
          <button className={tipoGrafico === 'colunas' ? 'ativo' : ''}
            onClick={() => setTipoGrafico('colunas')}>Colunas</button>
          <button className={tipoGrafico === 'linhas' ? 'ativo' : ''}
            onClick={() => setTipoGrafico('linhas')}>Linhas</button>
          <button className={tipoGrafico === 'pizza' ? 'ativo' : ''}
            onClick={() => setTipoGrafico('pizza')}>Pizza</button>
        </div>

        {/* "Horas por setor" só faz sentido vendo todos; ao filtrar, some. */}
        {setorView === '' ? (
          <div className="grid grid--admin">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Horas por setor</h2>
                  <p className="panel-sub">{rotuloMes(mesView)}</p>
                </div>
              </div>
              <Grafico dados={analise.por_setor} vazio="Sem dados neste mês." />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Horas por atividade</h2>
                  <p className="panel-sub">{rotuloMes(mesView)}</p>
                </div>
              </div>
              <Grafico dados={analise.por_atividade} vazio="Sem dados neste mês." />
            </section>
          </div>
        ) : (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Horas por atividade</h2>
                <p className="panel-sub">{setorView} · {rotuloMes(mesView)}</p>
              </div>
            </div>
            <Grafico dados={analise.por_atividade} vazio="Sem dados neste mês." />
          </section>
        )}

        {/* Horas totais por membro (soma de todos os registros, desde o início) */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Horas totais por membro</h2>
              <p className="panel-sub">
                Desde o início · {setorView ? `setor ${setorView}` : 'todos os setores'}
              </p>
            </div>
          </div>

          {totais.length === 0 ? (
            <div className="empty"><p>Nenhum membro cadastrado.</p></div>
          ) : (
            <>
              <div className="tabela-wrap">
                <table className="tabela tabela--compacta">
                  <thead>
                    <tr><th>Membro</th><th className="num">Lançamentos</th><th className="num">Horas totais</th></tr>
                  </thead>
                  <tbody>
                    {(verTodosTotais ? totais : totais.slice(0, 5)).map((t) => (
                      <tr key={t.nome} className={t.qtd === 0 ? 'linha-vazia' : ''}>
                        <td className="forte-nome">{t.nome}</td>
                        <td className="num">{t.qtd}</td>
                        <td className="num forte">{formatarMinutos(t.total_minutos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totais.length > 5 && (
                <button className="btn btn-ghost ver-mais" onClick={() => setVerTodosTotais((v) => !v)}>
                  {verTodosTotais ? 'Ver menos' : `Ver todos (${totais.length})`}
                </button>
              )}
            </>
          )}
        </section>

        {/* Lançamentos detalhados (com descrição) */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Lançamentos detalhados</h2>
              <p className="panel-sub">{rotuloMes(mesView)} · {lancamentos.length} lançamento(s)</p>
            </div>
          </div>

          {lancamentos.length === 0 ? (
            <div className="empty"><p>Nenhum lançamento neste mês.</p></div>
          ) : (
            <>
              <div className="tabela-wrap">
                <table className="tabela tabela--compacta">
                  <thead>
                    <tr>
                      <th>Data</th><th>Membro</th><th>Setor</th><th>Atividade</th>
                      <th className="num">Horas</th><th>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(verTodos ? lancamentos : lancamentos.slice(0, 5)).map((l, i) => (
                      <tr key={i}>
                        <td className="num">{formatarData(l.data)}</td>
                        <td className="forte-nome">{l.nome}</td>
                        <td className="setores">{l.setor}</td>
                        <td>{l.atividade}</td>
                        <td className="num forte">{formatarMinutos(l.minutos)}</td>
                        <td className="descricao-cel">{l.descricao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lancamentos.length > 5 && (
                <button className="btn btn-ghost ver-mais" onClick={() => setVerTodos((v) => !v)}>
                  {verTodos ? 'Ver menos' : `Ver todos (${lancamentos.length})`}
                </button>
              )}
            </>
          )}
        </section>

        {/* Gestão de membros */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Membros e acessos</h2>
              <p className="panel-sub">Cadastre novos membros e controle quem pode entrar</p>
            </div>
          </div>

          <form onSubmit={adicionarMembro} className="form-membro">
            <input className="input" type="email" required placeholder="e-mail corporativo"
              value={novo.email} onChange={(e) => setNovo((n) => ({ ...n, email: e.target.value }))} />
            <input className="input" type="text" required placeholder="Nome Sobrenome"
              value={novo.nome} onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))} />
            <input className="input" type="text" required placeholder="senha inicial"
              value={novo.senha} onChange={(e) => setNovo((n) => ({ ...n, senha: e.target.value }))} />
            <select className="input" value={novo.role}
              onChange={(e) => setNovo((n) => ({ ...n, role: e.target.value }))}>
              <option value="membro">Membro</option>
              <option value="gestor">Gestor</option>
            </select>
            <button type="submit" className="btn btn-primary">Adicionar</button>
          </form>
          <p className="form-nota">
            A senha inicial é provisória — o membro define a própria senha no primeiro acesso.
          </p>

          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th className="num">Acesso</th></tr>
              </thead>
              <tbody>
                {membros.map((m) => (
                  <tr key={m.id} className={m.ativo ? '' : 'linha-vazia'}>
                    <td className="forte-nome">{m.nome}</td>
                    <td className="setores">{m.email}</td>
                    <td>{m.role === 'gestor' ? 'Gestor' : 'Membro'}</td>
                    <td className="num">
                      {m.role === 'gestor' ? (
                        <span className="setores">conta fixa</span>
                      ) : (
                        <button className={m.ativo ? 'btn btn-ghost' : 'btn btn-primary'}
                          onClick={() => alternarAtivo(m)}>
                          {m.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
