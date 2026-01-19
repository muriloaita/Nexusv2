
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Sparkles, Mail, Lock, UserPlus, LogIn, ChevronRight, CheckCircle, WifiOff } from 'lucide-react';
import { signInWithEmail, signUpWithEmail, checkConnection } from '../services/supabaseClient';
import { NexusLogo } from './NexusLogo';

interface LoginScreenProps {
    onGuestLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onGuestLogin }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    checkConnection().then(online => {
      setIsOnline(online);
      if (!online) {
        setErrorMsg("Servidor central offline. Você pode acessar via Modo Local (Visitante).");
      }
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        setErrorMsg("Por favor, preencha todos os campos.");
        return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isRegistering) {
        const { error } = await signUpWithEmail(email, password);
        if (error) throw error;
        setSuccessMsg("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
      } else {
        const { error, data } = await signInWithEmail(email, password);
        if (error) {
          if (error.message.includes('fetch')) {
            throw new Error("Falha na conexão com o banco de dados. Tente o modo Visitante.");
          }
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setErrorMsg(error.message || "Erro ao processar autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4 py-12">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[128px] animate-pulse" />

      <div className="relative z-10 bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 md:p-12 rounded-[48px] shadow-2xl max-w-lg w-full text-center space-y-8 animate-fade-in">
        
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
              <div className="relative w-28 h-28 bg-slate-950 rounded-[32px] flex items-center justify-center shadow-2xl border border-white/10 group active-scale p-4 overflow-hidden">
                <NexusLogo className="w-full h-full drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" />
              </div>
          </div>
          <div className="space-y-2">
              <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">NEXUS<span className="text-indigo-500">APP</span></h1>
              <div className="flex items-center justify-center gap-2">
                <p className="text-slate-400 text-[10px] font-bold tracking-[0.3em] uppercase opacity-70">Sua Central de Inteligência</p>
                {!isOnline && <span className="text-amber-500" title="Offline"><WifiOff size={10}/></span>}
              </div>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button 
                onClick={() => { setIsRegistering(false); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${!isRegistering ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                disabled={!isOnline}
            >
                <LogIn size={14} /> ENTRAR
            </button>
            <button 
                onClick={() => { setIsRegistering(true); setErrorMsg(null); setSuccessMsg(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${isRegistering ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                disabled={!isOnline}
            >
                <UserPlus size={14} /> CADASTRAR
            </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-5 text-left">
            {errorMsg && (
                <div className={`rounded-2xl p-4 flex gap-3 items-center animate-shake border ${!isOnline ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    {!isOnline ? <WifiOff className="text-amber-400 shrink-0" size={18} /> : <AlertCircle className="text-red-400 shrink-0" size={18} />}
                    <p className={`text-xs font-bold leading-tight ${!isOnline ? 'text-amber-200' : 'text-red-200'}`}>{errorMsg}</p>
                </div>
            )}

            {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex gap-3 items-center animate-fade-in">
                    <CheckCircle className="text-emerald-400 shrink-0" size={18} />
                    <p className="text-xs text-emerald-200 font-bold leading-tight">{successMsg}</p>
                </div>
            )}

            <div className="space-y-4">
                <div className="group relative">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <Mail size={18} />
                    </div>
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Seu e-mail"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white text-sm outline-none focus:border-indigo-500 focus:bg-white/10 transition-all placeholder-slate-600 disabled:opacity-50"
                        required
                        disabled={!isOnline}
                    />
                </div>
                <div className="group relative">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <Lock size={18} />
                    </div>
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sua senha"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white text-sm outline-none focus:border-indigo-500 focus:bg-white/10 transition-all placeholder-slate-600 disabled:opacity-50"
                        required
                        disabled={!isOnline}
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading || !isOnline}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl active-scale disabled:opacity-50 group"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                        <span>{isRegistering ? "CRIAR CONTA" : "ACESSAR HUB"}</span>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>
        </form>

        <div className="space-y-4 pt-2">
          <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[9px] uppercase font-black text-slate-600 tracking-[0.3em]"><span className="bg-slate-900/40 px-4">OPÇÕES DE ACESSO</span></div>
          </div>

          <button
            onClick={onGuestLogin}
            className={`w-full font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border active-scale group ${!isOnline ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl' : 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border-indigo-500/20'}`}
          >
             <Sparkles size={18} className={isOnline ? "group-hover:animate-spin-slow" : "animate-pulse"} />
             <span>Continuar como Visitante {!isOnline && "(Modo Local)"}</span>
          </button>
          
          <div className="pt-4 opacity-50">
             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                Ao acessar você concorda com os termos Nexus.<br/>
                Segurança de Dados ponta-a-ponta.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
