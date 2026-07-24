declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker;
    };
  }
  // eslint-disable-next-line no-var
  var MonacoEnvironment:
    | {
        getWorker: (workerId: string, label: string) => Worker;
      }
    | undefined;
}

export {};
