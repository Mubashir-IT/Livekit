import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = dirname(__filename);

interface Replacements {
    [key: string]: string  ;
}

class EmailTemplates {
    static async loadTemplate(templateName: string, replacements: Replacements): Promise<string> {
        try {
            const templatePath: string = join(__dirname, '..', 'views', 'email_template', `${templateName}.html`);
            let template: string = await fs.readFile(templatePath, 'utf8');

            // Replace all placeholders with actual values
            Object.keys(replacements).forEach(key => {
                const regex: RegExp = new RegExp(`{{${key}}}`, 'g');
                template = template.replace(regex, replacements[key]);
            });

            return template;
        } catch (error) {
            console.error('Error loading email template:', error);
            throw error;
        }
    }
}

export default EmailTemplates;
