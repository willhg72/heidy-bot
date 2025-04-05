"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Create app as NestExpressApplication to access express-specific methods
            const app = yield core_1.NestFactory.create(app_module_1.AppModule);
            // Serve static files from the 'public' directory
            app.useStaticAssets((0, path_1.join)(__dirname, '..', 'public'));
            // Try a different port (3001 instead of the default 3000)
            const port = process.env.PORT || 3001;
            yield app.listen(port);
            console.log(`Application is running on: ${yield app.getUrl()}`);
        }
        catch (error) {
            console.error('Failed to start the application:', error);
        }
    });
}
bootstrap();
