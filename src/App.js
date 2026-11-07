import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { session, isGoogle, toast, localRooms, loadHome } from './store.js';
import NavMenu from './components/NavMenu.js';
import WelcomeView from './views/WelcomeView.js';
import HomeView from './views/HomeView.js';
import GangView from './views/GangView.js';
import ManageView from './views/ManageView.js';
import MeetupView from './views/MeetupView.js';
import AcceptView from './views/AcceptView.js';

// Routes live in the hash (code-side a gang is still a "room"):
//   #new (home, open "สร้างแก๊งใหม่")  #r-{gang}  #manage-{gang}  #m-{gang}-{meetup}  #g-{gangCode} (gang link)  #j-{gangCode}-{personalCode} (personal link)
function parse(hash) {
  const h = (hash || '').replace(/^#/, '');
  let m;
  if ((m = h.match(/^j-([A-Za-z0-9]{6})-([A-Za-z0-9]{8})$/))) return { name: 'join', roomCode: m[1].toUpperCase(), guestCode: m[2].toUpperCase() };
  if (h === 'new') return { name: 'home', create: true };
  if ((m = h.match(/^g-([A-Za-z0-9]{6})$/))) return { name: 'accept', code: m[1].toUpperCase() };
  if ((m = h.match(/^m-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/))) return { name: 'meetup', roomId: m[1], meetId: m[2] };
  if ((m = h.match(/^manage-([A-Za-z0-9]+)$/))) return { name: 'manage', roomId: m[1] };
  if ((m = h.match(/^r-([A-Za-z0-9]+)$/))) return { name: 'room', roomId: m[1] };
  return { name: 'home' };
}

export default {
  name: 'App',
  components: { NavMenu, WelcomeView, HomeView, GangView, ManageView, MeetupView, AcceptView },
  setup() {
    const route = ref(parse(location.hash));
    const onHash = () => { route.value = parse(location.hash); window.scrollTo(0, 0); };
    onMounted(() => window.addEventListener('hashchange', onHash));
    onUnmounted(() => window.removeEventListener('hashchange', onHash));

    const view = computed(() => {
      const r = route.value;
      if (!session.ready) return 'loading';
      if (r.name === 'join') return 'welcome';
      if (r.name === 'accept') return 'accept';
      if (!session.user) return 'welcome';
      return r.name;
    });

    // Menu: drawer on phones, sidebar (folds to icons, remembered) on wide screens.
    const drawer = ref(false);
    const rail = ref((() => { try { return localStorage.getItem('wangmai.rail') === '1'; } catch { return false; } })());
    function toggleRail() {
      rail.value = !rail.value;
      try { localStorage.setItem('wangmai.rail', rail.value ? '1' : '0'); } catch { /* private mode */ }
    }
    watch(route, () => { drawer.value = false; });
    const withMenu = computed(() => !!session.user && !['welcome', 'accept', 'loading'].includes(view.value));
    const current = computed(() => (route.value.roomId || (view.value === 'home' ? 'home' : '')));

    // Gangs for the menu and the home page.
    watch(() => [session.user && session.user.uid, session.profile && (session.profile.rooms || []).join(','), localRooms.value.length],
      () => { if (session.user && !(isGoogle.value && session.profileLoaded && !session.profile)) loadHome(); }, { immediate: true });

    return { route, view, session, isGoogle, toast, drawer, rail, toggleRail, withMenu, current };
  },
  template: /* html */ `
  <div class="app" :class="{ 'with-menu': withMenu }">
  <NavMenu v-if="withMenu" :open="drawer" :rail="rail" :current="current" @close="drawer = false" @toggle-rail="toggleRail" />
  <main class="shell" :class="{ narrow: view === 'welcome' || view === 'accept' }">
    <header class="row between top-bar" v-if="withMenu">
      <button type="button" class="icon-btn menu-btn" aria-label="เมนู" :aria-expanded="drawer" @click="drawer = true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
      </button>
      <a href="#" class="row grow" style="text-decoration: none; gap: 10px" aria-label="หน้าแรก">
        <span class="logo" aria-hidden="true" style="grid-template-columns: repeat(2, 10px); gap: 2px">
          <span style="width:10px;height:10px;background:#E5484D"></span><span style="width:10px;height:10px;background:#3E63DD"></span>
          <span style="width:10px;height:10px;background:#F5B100"></span><span style="width:10px;height:10px;background:#30A46C"></span>
        </span>
        <span class="display" style="font-size: 18px">ว่างไหม</span>
      </a>
    </header>

    <p v-if="view === 'loading'" class="muted">กำลังโหลด…</p>
    <WelcomeView v-else-if="view === 'welcome'" :room-code="route.roomCode || ''" :guest-code="route.guestCode || ''" />
    <AcceptView v-else-if="view === 'accept'" :code="route.code" />
    <HomeView v-else-if="view === 'home'" :start-creating="!!route.create" />
    <GangView v-else-if="view === 'room'" :room-id="route.roomId" />
    <ManageView v-else-if="view === 'manage'" :room-id="route.roomId" />
    <MeetupView v-else-if="view === 'meetup'" :room-id="route.roomId" :meet-id="route.meetId" />

    <div class="toast" :class="toast.kind" v-if="toast.text" role="status">{{ toast.text }}</div>
  </main>
  </div>`,
};
