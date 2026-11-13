/** Prints CLI errors as one readable line instead of a stack trace. */
process.on('uncaughtException', (error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
