export async function imprimirPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      resolve();
    };
    setTimeout(resolve, 2500);
  });

  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
