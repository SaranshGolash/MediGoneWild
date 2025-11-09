document.addEventListener("DOMContentLoaded", () => {
  // --- All Selectors ---
  const btnOpen = document.querySelector("#btn-open");
  const btnClose = document.querySelector("#btn-close");
  const media = window.matchMedia("(width < 900px)");
  const navLinkContainer = document.querySelector(".nav-link-container");
  const navLinks = document.querySelectorAll("[data-scroll]");
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

  // --- Function Definitions (now inside, so they can access the consts) ---

  // Open menu
  function openMobileMenu() {
    btnOpen.setAttribute("aria-expanded", "true");
    navLinkContainer.removeAttribute("inert");
    navLinkContainer.removeAttribute("style");
    btnClose.focus();
  }

  // Close menu
  function closeMobileMenu() {
    btnOpen.setAttribute("aria-expanded", "false");
    btnOpen.focus();
    setTimeout(() => {
      navLinkContainer.style.transition = "none";
    }, 500);
  }

  function setUpNav(e) {
    if (e.matches) {
      //is mobile
      console.log("Is mobile");
      navLinkContainer.setAttribute("inert", "");
      navLinkContainer.style.transition = "none";
    } else {
      //is tablet/desktop
      console.log("is desktop");
      navLinkContainer.removeAttribute("inert");
      closeMobileMenu();
    }
  }

  // --- User Dropdown Logic ---
  if (userMenuBtn) {
    userMenuBtn.addEventListener("click", () => {
      // Toggle the .show and .open classes
      userDropdown.classList.toggle("show");
      userMenuBtn.classList.toggle("open");
    });
  }

  // Close dropdown if clicking outside of it
  window.addEventListener("click", (e) => {
    if (
      userMenuBtn &&
      userDropdown && // Check if dropdown exists
      !userMenuBtn.contains(e.target) &&
      !userDropdown.contains(e.target)
    ) {
      if (userDropdown.classList.contains("show")) {
        userDropdown.classList.remove("show");
        userMenuBtn.classList.remove("open");
      }
    }
  });

  // --- Mobile Nav Logic ---
  // Only run if the mobile nav buttons actually exist
  if (btnOpen && btnClose && navLinkContainer) {
    btnOpen.addEventListener("click", openMobileMenu);
    btnClose.addEventListener("click", closeMobileMenu);

    media.addEventListener("change", (e) => {
      setUpNav(e);
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (media.matches) {
          closeMobileMenu();
        }
      });
    });

    // --- Initial Call ---
    setUpNav(media);
  }
});
