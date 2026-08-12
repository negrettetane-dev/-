import React from 'react';
import { Camera, Leaf, MapPinned, Navigation2, Route, ShieldCheck, Sparkles } from 'lucide-react';
import FoldText from '../../components/FoldText/FoldText';
import { Card } from '../../components/ui/card';

interface AuthShellProps {
  variant: 'login' | 'register';
  children: React.ReactNode;
}

const loginFeatures = [
  { icon: MapPinned, title: '实时路况', detail: '城市交通态势一屏掌握' },
  { icon: Navigation2, title: '智能出行', detail: '多模式路线精准规划' },
  { icon: Camera, title: '市民共治', detail: '身边交通问题随手上报' },
  { icon: Leaf, title: '绿色激励', detail: '低碳出行积累专属权益' },
];

const registerStats = [
  { value: '50万+', label: '注册用户' },
  { value: '5,000+', label: '合作停车场' },
  { value: '98%', label: '问题处置率' },
];

export const AuthShell: React.FC<AuthShellProps> = ({ variant, children }) => (
  <main className="relative min-h-screen overflow-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-cyan-200/35 blur-3xl" />
    </div>

    <Card className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1120px] overflow-hidden lg:grid-cols-[0.92fr_1.08fr]">
      <section className="auth-glow auth-grid relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-12">
        <div className="absolute -right-20 top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute -right-6 top-36 h-40 w-40 rounded-full border border-white/10" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20 backdrop-blur">
            <Route className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-[0.16em]">智途云枢</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.28em] text-blue-200">Smart Mobility</div>
          </div>
        </div>

        <div className="relative z-10 mt-16 max-w-sm">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            城市级智慧交通服务平台
          </div>
          <h1 className="m-0">
            <FoldText
              text={variant === 'login' ? '  让每一次出发，' : '连接城市服务，'}
              splitBy="char"
              hinge="top"
              trigger="mount"
              duration={0.75}
              stagger={0.055}
              ease="power3.out"
              perspective={700}
              creaseShading={0.55}
              fontSize="clamp(2.25rem, 3vw, 2.625rem)"
              fontWeight={600}
              color="#ffffff"
              className="auth-fold-title"
              style={{ lineHeight: 1.18 }}
            />
            <span className="block pl-[3em]">
              <FoldText
                text={variant === 'login' ? '  都有更优解' : '共建绿色未来'}
                splitBy="char"
                hinge="top"
                trigger="mount"
                duration={0.75}
                stagger={0.055}
                ease="power3.out"
                perspective={700}
                creaseShading={0.55}
                fontSize="clamp(2.25rem, 3vw, 2.625rem)"
                fontWeight={600}
                color="#67e8f9"
                className="auth-fold-title"
                style={{ lineHeight: 1.18 }}
              />
            </span>
          </h1>
          <p className="mt-5 text-sm leading-7 text-blue-100/75">
            多源数据融合、智能路线决策与城市协同治理，<br />为市民提供可靠、便捷、低碳的出行体验。
          </p>
        </div>

        {variant === 'login' ? (
          <div className="relative z-10 mt-auto grid grid-cols-2 gap-3 pt-10">
            {loginFeatures.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.065] p-4 backdrop-blur-sm">
                <Icon className="mb-3 h-5 w-5 text-cyan-300" />
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-1 text-[11px] leading-5 text-blue-100/60">{detail}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative z-10 mt-auto pt-12">
            <div className="mb-5 flex items-center gap-2 text-sm text-blue-100/80">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              数据安全保护 · 服务全程可信
            </div>
            <div className="grid grid-cols-3 gap-3">
              {registerStats.map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-4 text-center backdrop-blur-sm">
                  <div className="text-xl font-semibold text-cyan-300">{stat.value}</div>
                  <div className="mt-1 text-[11px] text-blue-100/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex min-w-0 items-center bg-white px-5 py-8 sm:px-10 lg:px-14 xl:px-16">
        <div className="mx-auto w-full max-w-[470px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-wider text-slate-900">智途云枢</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Smart Mobility</div>
            </div>
          </div>
          {children}
        </div>
      </section>
    </Card>
  </main>
);
