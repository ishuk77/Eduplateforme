const navigation = document.querySelector('#shell-nav');
const menuToggle = document.querySelector('#menu-toggle');
const navBackdrop = document.querySelector('#nav-backdrop');
const mobileMediaQuery = window.matchMedia('(min-width: 960px)');

function setNavigationState(isOpen) {
  if (!navigation || !menuToggle || !navBackdrop) {
    return;
  }

  navigation.setAttribute('data-open', String(isOpen));
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  navBackdrop.hidden = !isOpen;
}

if (navigation && menuToggle && navBackdrop) {
  setNavigationState(false);

  menuToggle.addEventListener('click', () => {
    const isOpen = navigation.getAttribute('data-open') === 'true';
    setNavigationState(!isOpen);
  });

  navBackdrop.addEventListener('click', () => {
    setNavigationState(false);
  });

  navigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!mobileMediaQuery.matches) {
        setNavigationState(false);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setNavigationState(false);
    }
  });

  mobileMediaQuery.addEventListener('change', (event) => {
    setNavigationState(false);
    navBackdrop.hidden = !event.matches;
    if (event.matches) {
      navBackdrop.hidden = true;
    }
  });
}
