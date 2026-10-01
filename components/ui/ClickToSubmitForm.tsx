"use client";

import type { ComponentProps, KeyboardEvent } from "react";

/**
 * A form that only submits from its button. Enter in a text or number field
 * would otherwise send it off half-filled, so it is swallowed there. A textarea
 * still gets its new line, a focused button still presses on Enter, and an IME
 * still commits its composition.
 */
export default function ClickToSubmitForm({
  onKeyDown,
  ...props
}: ComponentProps<"form">) {
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    onKeyDown?.(event);

    if (
      event.key === "Enter" &&
      !event.nativeEvent.isComposing &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
    }
  }

  return <form {...props} onKeyDown={handleKeyDown} />;
}
