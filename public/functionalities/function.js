const btnOpen = document.querySelector("#btn-open");
const btnClose = document.querySelector("#btn-close");
//Show small screen menu to accessibility tools only when the below screen size matches
const media = window.matchMedia("(width < 900px)");
const navLinkContainer = document.querySelector(".nav-link-container");
const navLinks = document.querySelectorAll("[data-scroll]");
// User Dropdown Toggle
document.addEventListener("DOMContentLoaded", () => {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

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
      !userMenuBtn.contains(e.target) &&
      !userDropdown.contains(e.target)
    ) {
      if (userDropdown.classList.contains("show")) {
        userDropdown.classList.remove("show");
        userMenuBtn.classList.remove("open");
      }
    }
  });
});
function setUpNav(e) {
  if (e.matches) {
    //is mobile
    console.log("Is mobile");
    navLinkContainer.setAttribute("inert", "");
    // set transition value to none when screen size changes
    navLinkContainer.style.transition = "none";
  } else {
    //is tablet/desktop
    console.log("is desktop");
    navLinkContainer.removeAttribute("inert");
    //close menu automatically when user switch from mobile to desktop
    closeMobileMenu();
  }
}

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

  // set transition value to none when menu is closed
  setTimeout(() => {
    navLinkContainer.style.transition = "none";
  }, 500);
}
setUpNav(media); //run after whole content is loaded

btnOpen.addEventListener("click", openMobileMenu);
btnClose.addEventListener("click", closeMobileMenu);

media.addEventListener("change", function (e) {
  setUpNav(e);
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (media.matches) {
      closeMobileMenu();
    }
  });
});
