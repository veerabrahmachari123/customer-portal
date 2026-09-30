pipeline {
    agent any

    environment {
        IMAGE_NAME     = 'customer-portal'
        CONTAINER_NAME = 'customer-portal'
        HOST_PORT      = '8091'   // change if this port is already in use
        ADMIN_EMAIL    = 'admin@example.com'   // register with this email to become admin
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm   // pulls the source from Git
            }
        }

        stage('Test') {
            steps {
                // Tests run inside Docker (the "test" stage of the Dockerfile),
                // so Node.js is not needed on the Jenkins machine.
                bat "docker build --target test -t %IMAGE_NAME%:test ."
            }
        }

        stage('Build Image') {
            steps {
                bat "docker build -t %IMAGE_NAME%:%BUILD_NUMBER% -t %IMAGE_NAME%:latest ."
            }
        }

        stage('Deploy') {
            steps {
                bat "docker rm -f %CONTAINER_NAME% || exit /b 0"
                bat "docker run -d --name %CONTAINER_NAME% -p %HOST_PORT%:3000 -e APP_NAME=customer-portal -e NODE_ENV=production -e ADMIN_EMAIL=%ADMIN_EMAIL% %IMAGE_NAME%:latest"
            }
        }

        stage('Health Check') {
            steps {
                bat "ping -n 8 127.0.0.1 >nul"
                bat "curl -f http://localhost:%HOST_PORT%/health"
            }
        }
    }

    post {
        success { echo "Customer Portal is running at http://localhost:${HOST_PORT}" }
        failure { bat "docker logs %CONTAINER_NAME% || exit /b 0" }
    }
}
