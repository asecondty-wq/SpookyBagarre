// « toktok » : le faux réseau social du bar (parodie, affichage seul : rien ne sort du jeu). Le selfie à deux pris au bar
// (src/ui/bar.js : `selfie`) y est publié sur un téléphone posé à droite de l'écran (grille 640x360, css/bar.css) :
// la photo, la légende, des hashtags bidons, les likes et les commentaires qui tombent, dont ceux des autres potes.
//   const tok = new TokTok(parent); tok.post({ img, me, friend, drunk }); chaque image : tok.update(dt)
import { CHARS } from '../sim/chars/index.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// le compte de chaque perso, sa réaction sous la photo des autres, son hashtag
export const ACCOUNTS = {
  frog: ['croassassin_officiel', 'Croâ. Belle photo. J\'ai léché l\'écran, désolé.', '#croâ'],
  micron: ['president.micron', 'Photo validée. Par 49.3.', '#EnMarche'],
  bubba: ['gros.cainri', 'Too small. In America, les selfies sont plus grands.', '#Freedom'],
  parmesan: ['il_parmigiano', 'Bien affinée, cette photo. 24 mois minimum.', '#Affinage'],
  pika: ['pikaboo_dresseur', 'Deux humains sauvages ! Je les attrape tous les deux.', '#AttrapezLesTous'],
  tung: ['tungtungtung', 'Tung tung tung 🥁🥁🥁', '#SurLeTemps'],
  shark: ['tralalero.tralala', 'Tralalero 🦈👟👟👟', '#Tralalero'],
  catlady: ['folle_du_bus42', 'Vous avez vu mon chat dessus ? Zoomez.', '#MonChat'],
  pandrezz: ['pandrezz', 'Pas mal. Mais j\'étais plus fort sur la mienne.', '#UnMecTrèsFort'],
  aboueb: ['aboueb_dunk', 'Panier ! 🏀 Photo de l\'année.', '#CouscousRoyal'],
  tices: ['tices_flamm', 'On sent l\'odeur à travers l\'écran. C\'est pas moi.', '#Flammekueche'],
  omfu: ['omfu808', 'Il manque de la cowbell sur cette photo.', '#MoreCowbell'],
  lolobiscotto: ['lolobiscotto', 'Trop de lumière. Ou pas assez de Ricard.', '#Pastis'],
  jsan: ['jsan_et_reyji', 'Reyji a liké. Moi aussi, mais lui d\'abord.', '#Reyji'],
  nymano: ['nymano_sad404', 'J\'ai pleuré. C\'est beau. 😭', '#SadBoy'],
  bido: ['bido_bisous', 'Je vous aime tous les deux 💪❤️', '#Bisous'],
  epektase: ['epektase_solo', 'Ça mérite un solo. Je le poste ce soir.', '#Solo'],
  pprod: ['pprod_mixage', 'Bruit numérique à 3200 ISO. Sinon, top.', '#Mixage'],
  skanky: ['skanky_funk_lyon', 'Je suis dans le fond, là ? Non ? Je serai sur la prochaine.', '#FunkDeLyon'],
  anbuu: ['anbuu_lick', 'Bénie. 🙏 Ré mi fa sol mi do ré.', '#LeLick'],
};
const FANS = [['mamie_fantome', 'Bonne soirée les jeunes 👻'], ['spooky_fan_666', 'LES LÉGENDES 😭😭😭'], ['chauve_souris_77', 'qui est le squelette derrière ??'],
  ['citrouille_du_coin', 'je suis au bar d\'à côté, venez'], ['le_vrai_barman', 'payez vos ardoises.'], ['bot_99231', 'Super photo ! Clique ici pour gagner une citrouille 🎃'],
  ['fantome_triste', 'invitez-moi la prochaine fois…'], ['crypte_officielle', 'on adore ce duo 🖤'], ['vampire_du_7e', 'les dents, ça va, je trouve']];
const FANS_DRUNK = [['spooky_fan_666', 'pourquoi c\'est tout flou 💀'], ['mamie_fantome', 'mon petit, rentre chez toi'], ['chauve_souris_77', 'il est quelle heure là-bas ??'],
  ['le_vrai_barman', 'coupez-lui la pression.'], ['fantome_triste', 'le sol est penché ou c\'est moi']];
const CAPTIONS = ['moi et {n} 🍺', 'soirée au Dernier Verre avec {n}', '{n} m\'a forcé à prendre cette photo', 'le meilleur bar de l\'au-delà, avec {n}', 'duo légendaire : moi et {n}'];
const CAPTIONS_DRUNK = ['moi et {n} je crois', 'c qui lui', 'jsuis pas bourré c la photo qui tourne', 'on est 3 ou 2 sur la foto'];
const TAGS = ['#bar', '#potes', '#selfie', '#vendrediSoir', '#crypte', '#halloween', '#ambiance', '#pourtoi'];
const TAGS_DRUNK = ['#jaipasbu', '#lesoltourne', '#cétaitpasmoi', '#demainjarrête'];

function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace('.', ',') + ' k';
  return (n / 1e6).toFixed(1).replace('.', ',') + ' M';
}

export class TokTok {
  constructor(parent) {
    this.el = document.createElement('div');
    this.el.className = 'toktok';
    parent.appendChild(this.el);
    this.followers = 120 + Math.floor(Math.random() * 300);
    this.posts = 0;
    this.cur = null;
  }

  // publie un selfie : img (une image en data URL), me et friend (des ids de persos), drunk (le tournis, en bières)
  post({ img, me, friend, drunk = 0 }) {
    const ivre = drunk >= 3;
    const F = CHARS[friend], acc = ACCOUNTS[me] || ['toi', '', '#moi'], fac = ACCOUNTS[friend] || ['?', '', ''];
    const cap = pick(ivre ? CAPTIONS_DRUNK : CAPTIONS).replace('{n}', '@' + fac[0]);
    const tags = ['#LeDernierVerre', fac[2], acc[2], pick(TAGS), ivre ? pick(TAGS_DRUNK) : pick(TAGS)].filter((x, i, a) => x && a.indexOf(x) === i);
    // les commentaires : le pote de la photo, d'autres potes, des fans (et des inquiets quand on a bu)
    const others = Object.keys(ACCOUNTS).filter((c) => c !== me && c !== friend && CHARS[c]);
    const com = [[fac[0], pick(['trop bien ce soir 🍻', 'supprime ça stp 😭', 'j\'ai les yeux fermés là non ?', 'on remet ça quand tu veux', 'ma meilleure photo, je la mets en fond d\'écran'])]];
    for (let i = 0; i < 5; i++) { const c = others.splice(Math.floor(Math.random() * others.length), 1)[0]; com.push([ACCOUNTS[c][0], ACCOUNTS[c][1]]); }
    const fans = [...FANS].sort(() => Math.random() - 0.5).slice(0, 3);
    if (ivre) fans.push(...[...FANS_DRUNK].sort(() => Math.random() - 0.5).slice(0, 2));
    for (const f of fans) com.splice(1 + Math.floor(Math.random() * com.length), 0, f);
    this.posts++;
    const likes = Math.round((1500 + Math.random() * 30000) * (1 + drunk * 0.35));
    this.cur = { t: 0, life: 12, likes, shown: 0, com, ci: 0, nextC: 0.6, hearts: 0, gainF: Math.round(likes / (8 + Math.random() * 6)), f0: this.followers };
    this.el.innerHTML = `<div class="tk-phone"><div class="tk-screen">
        <img class="tk-photo" src="${img}" alt="">
        <div class="tk-top"><b class="tk-logo">toktok</b><small>Pour toi · <u>Abonnés</u></small></div>
        <div class="tk-side">
          <i class="tk-av" style="--cc:${F ? F.color : '#fff'}"><img src="assets/ui/portraits/${friend}.png" alt=""></i>
          <span class="tk-k"><em>♥</em><b class="tk-likes">0</b></span>
          <span class="tk-k"><em>💬</em><b class="tk-coms">0</b></span>
          <span class="tk-k"><em>↗</em><b class="tk-shares">0</b></span>
        </div>
        <div class="tk-feed"></div>
        <div class="tk-info"><b>@${esc(acc[0])}</b> <small class="tk-fol"></small><p>${esc(cap)}</p><p class="tk-tags">${tags.map(esc).join(' ')}</p><p class="tk-song">♪ son original · Le Dernier Verre</p></div>
        <div class="tk-hearts"></div>
      </div></div><div class="tk-new">NOUVEAU POST !</div>`;
    this.q = { likes: this.el.querySelector('.tk-likes'), coms: this.el.querySelector('.tk-coms'), shares: this.el.querySelector('.tk-shares'),
      feed: this.el.querySelector('.tk-feed'), fol: this.el.querySelector('.tk-fol'), hearts: this.el.querySelector('.tk-hearts') };
    // les commentaires s'empilent juste au-dessus de la légende (sa hauteur dépend du texte)
    this.q.feed.style.bottom = (this.el.querySelector('.tk-info').offsetHeight + 10) + 'px';
    this.el.classList.remove('out'); this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    this.update(0);
  }

  get open() { return !!this.cur; }

  update(dt) {
    const C = this.cur;
    if (!C) return;
    C.t += dt;
    // les likes montent vite au début, puis de moins en moins (et les abonnés suivent)
    const k = 1 - Math.exp(-C.t / 2.4);
    const L = C.likes * k;
    const q = this.q;
    if (Math.floor(L) !== C.shown) {
      const gained = Math.floor(L) - C.shown;
      C.shown = Math.floor(L);
      q.likes.textContent = fmt(L);
      q.shares.textContent = fmt(L / 23);
      this.followers = C.f0 + Math.round(C.gainF * k);
      q.fol.textContent = '· ' + fmt(this.followers) + ' abonnés';
      // des cœurs qui montent sur le côté (pas trop)
      C.hearts += Math.min(3, gained / 400);
    }
    while (C.hearts >= 1) {
      C.hearts -= 1;
      const hh = document.createElement('i');
      hh.textContent = '♥';
      hh.style.left = (Math.random() * 16) + 'px';
      hh.style.color = pick(['#ff3b6b', '#ff7ab0', '#ffd84a', '#ffffff']);
      q.hearts.appendChild(hh);
      hh.animate([{ transform: 'translate(0, 0) scale(.6)', opacity: 1 }, { transform: `translate(${(Math.random() - 0.5) * 18}px, -70px) scale(1.2)`, opacity: 0 }],
        { duration: 1100 + Math.random() * 500, easing: 'ease-out' }).onfinish = () => hh.remove();
    }
    // les commentaires arrivent un par un (les trois derniers restent : la photo doit se voir)
    C.nextC -= dt;
    if (C.nextC <= 0 && C.ci < C.com.length) {
      const [who, txt] = C.com[C.ci++];
      const d = document.createElement('div');
      d.className = 'tk-c';
      d.innerHTML = `<b>@${esc(who)}</b> ${esc(txt)}`;
      q.feed.appendChild(d);
      while (q.feed.children.length > 3) q.feed.firstChild.remove();
      C.nextC = 0.8 + Math.random() * 0.7;
    }
    q.coms.textContent = fmt(C.ci * 37 + L / 60);
    if (C.t > C.life) this.close();
  }

  close() {
    if (!this.cur) return;
    this.cur = null;
    this.el.classList.remove('in'); this.el.classList.add('out');
  }

  dispose() { this.el.remove(); }
}
