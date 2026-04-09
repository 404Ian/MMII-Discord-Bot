/* | :: main.ts
 * - Main Entry Point
 */
(async () => {
    const { CLI, reloadBot } = await import(`./cli.js?update=${Date.now()}`);
    const logger = await import(`./utils/Logger.js?update=${Date.now()}`);
    await reloadBot();
    CLI();
    process.on('uncaughtException', (err) => {
        logger.error(`[UNHANDLED]: Uncaught Exception error occured:`, err.stack);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`[UNHANDLED]: Rejection error occured:`, reason.stack);
    });
    process.on('exit', (code) => {
        logger.error(`Proccess Exit with Code: ${code}`);
    });
    process.on('beforeExit', (code) => {
        logger.error(`[BEFORE]: Proccess Exit with Code: ${code}`);
    });
})();
export {};
