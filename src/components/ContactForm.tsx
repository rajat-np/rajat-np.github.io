/**
 * Contact Button - opens mail client
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information
 */

export default function ContactForm() {
  const subject = encodeURIComponent("Hello Rajat");
  const body = encodeURIComponent("Hi Rajat,\n\nI wanted to reach out about...");
  const mailto = `mailto:rajat.tcp@gmail.com?subject=${subject}&body=${body}`;

  return (
    <a
      href={mailto}
      className="inline-flex items-center justify-center px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium shadow-md"
    >
      📧 Email Me
    </a>
  );
}
