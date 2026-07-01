# Azure Web App Deployment Guide

Your application has been configured to serve both the React frontend and NestJS backend from a single Node.js application. This makes deploying to an Azure Web App much easier!

Here are the step-by-step instructions for deploying to a standard **Azure App Service (Node.js)**:

## 1. Prepare the Build

You only need to run one command to build the entire system. From your local `backend` directory, run:

```bash
npm run build:all
```

**What this does:**
1. Navigates to the `frontend` folder and runs the Vite build (`npm run build`).
2. Copies the resulting React `dist` folder into a new `backend/client` folder.
3. Runs the NestJS build for the backend.

> [!TIP]
> After this completes, the `backend` folder contains everything needed for production.

## 2. Deploy to Azure

You can deploy the `backend` folder to Azure using the **Azure App Service extension in VS Code** or via the Azure CLI. 

If you are using VS Code:
1. Right-click the `backend` folder in your file explorer.
2. Select **Deploy to Web App...** (Requires the Azure Tools extension).
3. Select your Azure Subscription and the target Node.js Web App.

Alternatively, you can ZIP the `backend` folder (excluding `node_modules` and `.git`) and use Azure's ZipDeploy.

## 3. Configure Azure Environment Variables

Once deployed, you must configure the following Application Settings (Environment Variables) in the Azure Portal for your Web App:

Navigate to **Azure Portal > Your Web App > Settings > Environment variables** and add:

- `DATABASE_URL`: The connection string to your production database (e.g., Azure Database for PostgreSQL).
- `JWT_SECRET`: A secure random string used to sign user tokens.
- `PORT`: `8080` (Azure sets this automatically, but ensure your app listens to `process.env.PORT` which it already does!).

## 4. Set the Startup Command

By default, Azure might try to run `npm start` (which runs the development server). You need to instruct Azure to run the production script.

Navigate to **Azure Portal > Your Web App > Settings > Configuration > General settings** and set the **Startup Command** to:

```bash
npm run start:prod
```

> [!IMPORTANT]
> The `start:prod` script is configured to automatically run `npx prisma migrate deploy` before starting the server. This guarantees that your Azure database schema is always up-to-date with your Prisma models before the app accepts traffic.

## 5. Restart and Verify

Restart your Azure Web App. 
- Access your App Service URL (e.g., `https://my-irms-app.azurewebsites.net`).
- You should see the React login page! All `/api/*` requests will seamlessly hit the NestJS backend, and all other requests will serve the React interface.
