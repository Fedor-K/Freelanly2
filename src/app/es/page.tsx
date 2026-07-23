import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';

// Spanish lander (neutral LATAM register). Canon: personal AI ASSISTANT — the user
// always reviews and sends; never framed as auto-apply. App UI is English — stated honestly.

export const metadata: Metadata = {
  title: 'Freelanly — asistente personal de IA para postular a empleos y proyectos',
  description:
    'Freelanly encuentra vacantes y proyectos freelance que coinciden con tu perfil y redacta una carta de presentación a medida para cada uno — tú revisas y envías.',
  alternates: {
    canonical: `${siteConfig.url}/es`,
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
    q: '¿Freelanly envía postulaciones automáticamente?',
    a: 'No. Freelanly es un asistente, no un bot: encuentra las ofertas, redacta la carta y prepara todo — pero cada postulación la revisas y la envías tú, desde tu propio correo. Nada sale sin tu clic.',
  },
  {
    q: '¿Cuánto cuesta?',
    a: 'Registrarte es gratis y tu primera postulación corre por nuestra cuenta, sin tarjeta. Después puedes recargar saldo (desde $3 USD, $0.50 por postulación, nunca expira) o pasarte a PRO por $5 USD al mes: hasta 20 postulaciones al día, una cola matutina de borradores listos y tu CV adjunto en cada una.',
  },
  {
    q: '¿Funciona para conseguir trabajo remoto en Estados Unidos o Europa desde América Latina?',
    a: 'Ese es exactamente el caso de uso principal: la mayoría de nuestros usuarios son freelancers y candidatos remotos de América Latina e India que postulan a empresas de EE. UU. y Europa.',
  },
  {
    q: '¿La aplicación está en español?',
    a: 'La interfaz de la aplicación está en inglés por ahora. Las cartas de presentación se redactan en el idioma de la vacante — normalmente inglés, que es lo que esperan las empresas de EE. UU. y Europa.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: 'es',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function SpanishLander() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <MarketingNav />

      <main className="pt-32 pb-8">
        <div className="max-w-[820px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Para LATAM</span>
          <h1 className="text-[clamp(34px,4.6vw,56px)] font-semibold tracking-tighter mt-4 mb-6 leading-tight">
            Tu asistente personal de IA para <span className="text-[#C7F94A]">postular</span> a empleos y proyectos.
          </h1>
          <p className="text-[#D4D4D8] text-lg max-w-[62ch] mb-4 leading-relaxed">
            Freelanly detecta vacantes y proyectos freelance recién publicados — en posts de LinkedIn y páginas de
            carreras de empresas — que coinciden con tu perfil, y redacta una carta de presentación a medida para
            cada uno. <strong className="text-white">Tú la revisas y la envías</strong>, desde tu propio Gmail.
          </p>
          <p className="text-[14px] text-[#6B7280] mb-8">
            La interfaz de la app está en inglés · Tu primera postulación es gratis, sin tarjeta.
          </p>
          <div className="flex gap-3 flex-wrap mb-20">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px]"
              style={{ background: '#C7F94A', color: '#0A0B0F' }}
            >
              Empieza gratis →
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border"
              style={{ borderColor: 'rgba(255,255,255,0.14)' }}
            >
              Cómo funciona
            </Link>
          </div>

          {/* 3 pasos */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {[
              ['01 — Descubre', 'Ofertas frescas, antes que nadie', 'Escaneamos posts de contratación en LinkedIn y páginas de carreras cada pocas horas. Las vacantes llegan a tu feed antes de saturarse de candidatos.'],
              ['02 — Redacta', 'Una carta que no suena a IA', 'La IA lee la oferta completa, toma datos reales de tu perfil y portafolio, y escribe una carta corta y específica. Un segundo revisor de IA la verifica contra los requisitos.'],
              ['03 — Revisa y envía', 'Tú tienes el control, siempre', 'Cada postulación espera tu revisión. La editas si quieres y la envías desde tu propio correo. Después ves aperturas y respuestas en un solo panel.'],
            ].map(([num, h, p]) => (
              <div key={num as string} className="rounded-2xl p-6 border" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="font-mono text-[11px] tracking-widest uppercase text-[#C7F94A] mb-3">{num}</div>
                <h2 className="font-semibold mb-2">{h}</h2>
                <p className="text-[14px] text-[#A1A1AA] leading-relaxed">{p}</p>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Preguntas frecuentes</h2>
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

      {/* CTA final en español */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
        <div className="max-w-[800px] mx-auto px-8 text-center relative z-10">
          <h2 className="text-[clamp(32px,4vw,50px)] font-semibold tracking-tighter mb-5">
            Tu próximo cliente <span className="text-[#C7F94A]">ya está publicando.</span>
          </h2>
          <p className="text-[#D4D4D8] text-lg mb-8">Regístrate gratis — tu primera postulación corre por nuestra cuenta.</p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px]"
            style={{ background: '#C7F94A', color: '#0A0B0F' }}
          >
            Empieza gratis →
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
