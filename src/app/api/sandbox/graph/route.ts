import { NextRequest, NextResponse } from 'next/server';
import { Sandbox, SandboxOpts } from '@e2b/code-interpreter';

// E2B_API_KEY will be picked up from process.env by the SDK if not specified in create() options
// Ensure it is set in your .env.local or environment variables
if (!process.env.E2B_API_KEY) {
  console.error('CRITICAL: Missing E2B_API_KEY. Sandbox functionality will be disabled.');
}

const sandboxTimeout = 10 * 60 * 1000; // 10 minutes
const NEXTJS_PREVIEW_TEMPLATE_ID = "hgggu04t2bp3hyy3wktz"; // Your custom template ID
const NEXTJS_PREVIEW_TEMPLATE_NAME = "chatbot-ui-nextjs-preview"; // Your custom template name
// Corrected based on Dockerfile: Next.js project root in the template is /home/user
const SANDBOX_PROJECT_ROOT = "/home/user"; 

// Define the expected structure of the request body (the "fragment")
interface GraphFragment {
  template?: string; // Allow LLM to specify, but we will default or validate
  filePath?: string; // Relative to SANDBOX_PROJECT_ROOT, e.g., pages/index.tsx or app/my-page/page.tsx
  code: string; // The actual Next.js page/component code
  dependencies?: Record<string, string>; // Currently ignored by this route, template handles dependencies
  port?: number; // Port the application inside sandbox will run on, defaults to 3000 for Next.js
}

export async function POST(req: NextRequest) {
  // Check for API key at the start of the request, though SDK might also check internally
  if (!process.env.E2B_API_KEY) {
    return NextResponse.json({ error: 'Sandbox feature is not configured (missing API key).' }, { status: 503 });
  }

  let sandbox: Sandbox | undefined = undefined;
  let mkdirOutput: any | undefined = undefined;

  try {
    const fragment = (await req.json()) as GraphFragment;

    if (!fragment.code || !fragment.code.trim()) {
      return NextResponse.json({ error: 'Code must be provided in the fragment.' }, { status: 400 });
    }

    let templateID = fragment.template || NEXTJS_PREVIEW_TEMPLATE_ID;
    if (templateID !== NEXTJS_PREVIEW_TEMPLATE_ID && templateID !== NEXTJS_PREVIEW_TEMPLATE_NAME) {
      console.warn(`Warning: Received template ID "${templateID}" which is NOT the expected custom Next.js preview template ("${NEXTJS_PREVIEW_TEMPLATE_ID}" or "${NEXTJS_PREVIEW_TEMPLATE_NAME}"). This endpoint is tailored for it.`);
      // Potentially force templateID to NEXTJS_PREVIEW_TEMPLATE_ID or error out
      templateID = NEXTJS_PREVIEW_TEMPLATE_ID; // Override to ensure correct template
    }
    
    // Default filePath if useWebSocket.ts sends it (e.g. "components/GeneratedPreview.tsx")
    // The template uses --no-src-dir, so paths are relative to SANDBOX_PROJECT_ROOT (/home/user)
    const defaultRelativeFilePathForComponent = 'components/GeneratedPreview.tsx';
    const defaultPort = 3000;

    // filePath from fragment (e.g., "components/GeneratedPreview.tsx") or default
    const relativeFilePath = (fragment.filePath || defaultRelativeFilePathForComponent).replace(/^src\//, ''); // Remove leading src/ if present
    
    // Ensure relativeFilePath does not start with a slash
    const cleanRelativeFilePath = relativeFilePath.startsWith('/') ? relativeFilePath.substring(1) : relativeFilePath;
    const absoluteFilePathInSandbox = `${SANDBOX_PROJECT_ROOT}/${cleanRelativeFilePath}`;
    const port = fragment.port || defaultPort;

    console.log(`Creating sandbox with template: ${templateID}`);
    const sandboxOptions: Partial<SandboxOpts> = { timeoutMs: sandboxTimeout };
    sandbox = await Sandbox.create(templateID, sandboxOptions as any);

    const dirPathForFile = absoluteFilePathInSandbox.substring(0, absoluteFilePathInSandbox.lastIndexOf('/'));
    if (dirPathForFile && dirPathForFile !== SANDBOX_PROJECT_ROOT && dirPathForFile !== SANDBOX_PROJECT_ROOT + '/' && dirPathForFile !== '.' && dirPathForFile !== '') {
      console.log(`Ensuring directory exists: ${dirPathForFile}`);
      mkdirOutput = await sandbox.commands.run(`mkdir -p ${dirPathForFile}`);
      if (mkdirOutput.stderr) console.warn(`mkdir -p stderr for ${dirPathForFile}: ${mkdirOutput.stderr}`);
      console.log(`mkdir -p stdout for ${dirPathForFile}: ${mkdirOutput.stdout}`);
    }

    console.log(`Writing fragment code to ${absoluteFilePathInSandbox} in sandbox...`);
    await sandbox.files.write(absoluteFilePathInSandbox, fragment.code);
    console.log('Fragment code file written to sandbox.');

    // --- Dynamically create and write pages/index.tsx to render the component ---
    // This assumes the template uses Pages Router (due to --no-app)
    const mainPageIndexFile = `${SANDBOX_PROJECT_ROOT}/pages/index.tsx`;
    
    // If the fragment itself is pages/index.tsx, we don't need to overwrite it with an importer.
    if (cleanRelativeFilePath.toLowerCase() === 'pages/index.tsx') {
        console.log(`Fragment code IS pages/index.tsx. No separate importer page generated.`);
    } else {
        // Determine component name and import path using @/ alias (which points to SANDBOX_PROJECT_ROOT)
        const fileNameWithExtension = cleanRelativeFilePath.substring(cleanRelativeFilePath.lastIndexOf('/') + 1);
        const lastDotIndexForName = fileNameWithExtension.lastIndexOf('.');
        const componentName = lastDotIndexForName === -1 ? fileNameWithExtension : fileNameWithExtension.substring(0, lastDotIndexForName);

        const lastDotIndexForPath = cleanRelativeFilePath.lastIndexOf('.');
        const pathWithoutExtension = lastDotIndexForPath === -1 ? cleanRelativeFilePath : cleanRelativeFilePath.substring(0, lastDotIndexForPath);
        const importPath = `@/${pathWithoutExtension}`;

        const mainPageFileContent = `
import React from 'react';
import ${componentName} from '${importPath}';

export default function PreviewPage() {
  return (
    <React.StrictMode>
      <${componentName} />
    </React.StrictMode>
  );
}
`;
        console.log(`Overwriting ${mainPageIndexFile} to import ${componentName} from '${importPath}'`);
        await sandbox.files.write(mainPageIndexFile, mainPageFileContent);
        console.log(`${mainPageIndexFile} updated to render the fragment.`);
    }

    console.log(`Attempting to get hostname for port ${port}. Template: ${templateID}`);
    const hostname = await sandbox.getHost(port);

    if (!hostname) {
      console.error(`Failed to get sandbox hostname for port ${port}.`);
      // Fetch logs from compile_page.sh if it creates any, e.g., in /tmp/
      // let templateLogs = 'No template logs fetched.';
      // try { /* ... fetch logs ... */ } catch {}
      throw new Error(`Sandbox hostname could not be determined for port ${port}.`);
    }
    const previewUrl = `https://${hostname}`;
    console.log(`Sandbox preview URL: ${previewUrl}`);

    return NextResponse.json({
      url: previewUrl,
      code: fragment.code,
      sandboxID: sandbox.sandboxId,
      logs: {
        mkdir_stdout: mkdirOutput?.stdout,
        mkdir_stderr: mkdirOutput?.stderr,
      }
    });

  } catch (error: any) {
    let intendedTemplateId = NEXTJS_PREVIEW_TEMPLATE_ID;
    try {
      // This block might fail if req.json() itself failed or if fragment is not what we expect
      const bodyForErrorLogging = await req.json(); // Re-parse or use a stored version if available
      if (bodyForErrorLogging && bodyForErrorLogging.template) {
        intendedTemplateId = bodyForErrorLogging.template;
      }
    } catch (parseError) {
      // Ignore if parsing req.json() fails here, stick to default
      console.warn('Could not re-parse request body for error logging template ID.');
    }

    console.error(`Error in sandbox route (intended template: ${intendedTemplateId}): ${error.message}`, error.stack);
    
    const responseError: any = { 
        error: 'Failed to process sandbox request', 
        details: error.message, 
        templateUsed: intendedTemplateId // Report the template we believe was being used
    };
    if (process.env.NODE_ENV === 'development') { // Only send stack in development
        responseError.stack = error.stack;
    }
    return NextResponse.json(responseError, { status: 500 });
  } finally {
    if (sandbox) {
      console.log(`Sandbox ${sandbox.sandboxId} processing finished. Relying on auto-cleanup by E2B.`);
      // sandbox.close(); // E2B SDK v1.x and later auto-closes. For older versions, you might need this.
    }
  }
} 