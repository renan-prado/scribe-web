"use client";

import { useEffect, useState } from "react";

/**
 * 12-hour clock in a "3:07 pm" shape. The Greeting only ticks once a minute so
 * we compute the alignment to the next :00 second and then chain into a
 * setInterval to save a wasted repaint per second.
 */
function formatClock(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

export function Greeting() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="flex flex-col items-center gap-6 text-center">
      <span
        suppressHydrationWarning
        className="inline-flex items-center rounded-full bg-muted px-4 py-1.5 text-sm font-medium tabular-nums text-foreground"
      >
        {time || " "}
      </span>
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Olá, tudo bem?
      </h1>
      <p className="max-w-md text-balance text-base font-normal leading-relaxed text-muted-foreground">
        Transforme qualquer <strong className="font-semibold text-foreground">sermão</strong>,{" "}
        <strong className="font-semibold text-foreground">aula da EBD</strong>,{" "}
        <strong className="font-semibold text-foreground">palestra</strong> ou{" "}
        <strong className="font-semibold text-foreground">bate-papo</strong> em um resumo bíblico
        pronto para revisar e revisitar.
      </p>
    </section>
  );
}
