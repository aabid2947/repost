"use client";

import { gsap } from "./register";

/**
 * Stagger-animate children elements into view
 */
export function staggerIn(
  targets: gsap.TweenTarget,
  options?: {
    stagger?: number;
    duration?: number;
    y?: number;
    delay?: number;
  }
) {
  const { stagger = 0.08, duration = 0.6, y = 30, delay = 0 } = options || {};
  return gsap.fromTo(
    targets,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      delay,
      ease: "power3.out",
    }
  );
}

/**
 * Split-text style entrance — animates each word
 */
export function splitTextEntrance(
  container: HTMLElement,
  options?: { stagger?: number; duration?: number; y?: number }
) {
  const { stagger = 0.04, duration = 0.7, y = 40 } = options || {};
  const text = container.textContent || "";
  const words = text.split(" ");

  container.innerHTML = words
    .map(
      (word) =>
        `<span class="inline-block overflow-hidden"><span class="gsap-word inline-block">${word}</span></span>`
    )
    .join(" ");

  const wordEls = container.querySelectorAll(".gsap-word");
  return gsap.fromTo(
    wordEls,
    { y, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration,
      stagger,
      ease: "power3.out",
    }
  );
}

/**
 * Fade + scale entrance for a single element
 */
export function popIn(
  target: gsap.TweenTarget,
  options?: { scale?: number; duration?: number; delay?: number }
) {
  const { scale = 0.9, duration = 0.5, delay = 0 } = options || {};
  return gsap.fromTo(
    target,
    { opacity: 0, scale },
    {
      opacity: 1,
      scale: 1,
      duration,
      delay,
      ease: "back.out(1.7)",
    }
  );
}

/**
 * Magnetic mouse-follow effect for buttons
 */
export function makeMagnetic(element: HTMLElement, strength: number = 0.3) {
  const handleMouseMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(element, {
      x: x * strength,
      y: y * strength,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleMouseLeave = () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.3)",
    });
  };

  element.addEventListener("mousemove", handleMouseMove);
  element.addEventListener("mouseleave", handleMouseLeave);

  return () => {
    element.removeEventListener("mousemove", handleMouseMove);
    element.removeEventListener("mouseleave", handleMouseLeave);
  };
}

/**
 * Glint/shine effect for card hover
 */
export function addGlint(element: HTMLElement) {
  // Create glint overlay
  const glint = document.createElement("div");
  glint.className =
    "pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]";
  glint.innerHTML = `<div class="glint-bar absolute -left-full top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg]"></div>`;

  element.style.position = "relative";
  element.style.overflow = "hidden";
  element.appendChild(glint);

  const bar = glint.querySelector(".glint-bar") as HTMLElement;

  const handleEnter = () => {
    gsap.fromTo(
      bar,
      { left: "-100%" },
      { left: "200%", duration: 0.7, ease: "power2.inOut" }
    );
  };

  element.addEventListener("mouseenter", handleEnter);

  return () => {
    element.removeEventListener("mouseenter", handleEnter);
    if (glint.parentNode) glint.parentNode.removeChild(glint);
  };
}

/**
 * Hover scale micro-interaction
 */
export function addHoverScale(element: HTMLElement, scale: number = 1.03) {
  const handleEnter = () => {
    gsap.to(element, { scale, duration: 0.25, ease: "power2.out" });
  };
  const handleLeave = () => {
    gsap.to(element, { scale: 1, duration: 0.25, ease: "power2.out" });
  };

  element.addEventListener("mouseenter", handleEnter);
  element.addEventListener("mouseleave", handleLeave);

  return () => {
    element.removeEventListener("mouseenter", handleEnter);
    element.removeEventListener("mouseleave", handleLeave);
  };
}
