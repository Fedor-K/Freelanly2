import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';

// Brazilian-Portuguese lander. Canon: personal AI ASSISTANT — the user always reviews
// and sends; never framed as auto-apply. App UI is English — stated honestly.

export const metadata: Metadata = {
  title: 'Freelanly — assistente pessoal de IA para conseguir trabalho remoto tech',
  description:
    'O Freelanly encontra vagas e projetos freelance compatíveis com o seu perfil e redige uma carta de apresentação sob medida para cada um — você revisa e envia.',
  alternates: {
    canonical: `${siteConfig.url}/pt`,
    languages: {
      en: siteConfig.url,
      es: `${siteConfig.url}/es`,
      pt: `${siteConfig.url}/pt`,
      'x-default': siteConfig.url,
    },
  },
};

const faqs = [
  {
    q: 'O Freelanly envia candidaturas automaticamente?',
    a: 'Não. O Freelanly é um assistente, não um robô: ele encontra as vagas, redige a carta e deixa tudo pronto — mas cada candidatura é revisada e enviada por você, do seu próprio e-mail. Nada sai sem o seu clique.',
  },
  {
    q: 'Quanto custa?',
    a: 'O cadastro é gratuito e a primeira candidatura é por nossa conta, sem cartão. Depois você pode recarregar saldo (a partir de US$ 3, US$ 0,50 por candidatura, nunca expira) ou assinar o PRO por US$ 5 por mês: até 20 candidaturas por dia, uma fila matinal de rascunhos prontos e seu currículo anexado a cada uma.',
  },
  {
    q: 'Funciona para conseguir trabalho remoto nos EUA ou na Europa morando no Brasil?',
    a: 'Esse é exatamente o principal caso de uso: a maioria dos nossos usuários são freelancers e candidatos remotos da América Latina e da Índia se candidatando a empresas dos EUA e da Europa.',
  },
  {
    q: 'O aplicativo está em português?',
    a: 'A interface do aplicativo está em inglês por enquanto. As cartas de apresentação são redigidas no idioma da vaga — normalmente inglês, que é o que as empresas dos EUA e da Europa esperam.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: 'pt-BR',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function PortugueseLander() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <MarketingNav />

      <main className="pt-32 pb-8">
        <div className="max-w-[820px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Para o Brasil</span>
          <h1 className="text-[clamp(34px,4.6vw,56px)] font-semibold tracking-tighter mt-4 mb-6 leading-tight">
            Seu assistente pessoal de IA para conseguir <span className="text-[#C7F94A]">trabalho remoto tech</span> nos EUA e na Europa.
          </h1>
          <p className="text-[#D4D4D8] text-lg max-w-[62ch] mb-4 leading-relaxed">
            O Freelanly detecta vagas remotas de desenvolvimento, dados, DevOps e QA recém-publicadas — em posts do
            LinkedIn e páginas de carreiras de empresas — compatíveis com o seu perfil, e redige uma carta de apresentação sob medida
            para cada um. <strong className="text-white">Você revisa e envia</strong>, do seu próprio Gmail.
          </p>
          <p className="text-[14px] text-[#6B7280] mb-8">
            A interface do app está em inglês · Sua primeira candidatura é grátis, sem cartão.
          </p>
          <div className="flex gap-3 flex-wrap mb-20">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px]"
              style={{ background: '#C7F94A', color: '#0A0B0F' }}
            >
              Comece grátis →
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border"
              style={{ borderColor: 'rgba(255,255,255,0.14)' }}
            >
              Como funciona
            </Link>
          </div>

          {/* 3 passos */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {[
              ['01 — Descubra', 'Vagas frescas, antes de todo mundo', 'Escaneamos posts de contratação no LinkedIn e páginas de carreiras a cada poucas horas. As vagas chegam ao seu feed antes de lotar de candidatos.'],
              ['02 — Redija', 'Uma carta que não parece IA', 'A IA lê a vaga inteira, usa dados reais do seu perfil e portfólio e escreve uma carta curta e específica. Um segundo revisor de IA confere tudo contra os requisitos.'],
              ['03 — Revise e envie', 'Você no controle, sempre', 'Cada candidatura espera a sua revisão. Edite se quiser e envie do seu próprio e-mail. Depois acompanhe aberturas e respostas em um único painel.'],
            ].map(([num, h, p]) => (
              <div key={num as string} className="rounded-2xl p-6 border" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="font-mono text-[11px] tracking-widest uppercase text-[#C7F94A] mb-3">{num}</div>
                <h2 className="font-semibold mb-2">{h}</h2>
                <p className="text-[14px] text-[#A1A1AA] leading-relaxed">{p}</p>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Perguntas frequentes</h2>
          <div className="space-y-6 mb-8">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold mb-1.5">{f.q}</h3>
                <p className="text-[15px] text-[#A1A1AA] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* CTA final em português */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div className="max-w-[800px] mx-auto px-8 text-center relative z-10">
          <h2 className="text-[clamp(32px,4vw,50px)] font-semibold tracking-tighter mb-5">
            Seu próximo cliente <span className="text-[#C7F94A]">já está publicando.</span>
          </h2>
          <p className="text-[#D4D4D8] text-lg mb-8">Cadastre-se grátis — a primeira candidatura é por nossa conta.</p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px]"
            style={{ background: '#C7F94A', color: '#0A0B0F' }}
          >
            Comece grátis →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
