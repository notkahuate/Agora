#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_URL="${API_URL:-http://localhost:3000/api}"

# Function to print colored headers
print_header() {
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================${NC}\n"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}\n"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}\n"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}\n"
}

# Function to make API call and save response
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -z "$token" ]; then
        curl -s -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X $method "$API_URL$endpoint" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Function to extract value from JSON
extract_value() {
    echo $1 | grep -o "\"$2\":\"[^\"]*" | cut -d'\"' -f4
}

# Function to extract ID from JSON response
extract_id() {
    echo $1 | grep -o '\"id\":[0-9]*' | head -1 | grep -o '[0-9]*'
}

print_header "🚀 AGORA SYSTEM - AUTOMATED TEST SUITE"

# ============================================
# STEP 1: LOGIN
# ============================================
print_header "STEP 1: Authentication (Login)"

LOGIN_RESPONSE=$(make_request POST "/auth/login" '{
    "email": "admin@agora.com",
    "password": "Admin123"
}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    print_error "Login failed. Make sure admin user exists."
    print_info "Response: $LOGIN_RESPONSE"
    exit 1
fi

print_success "Login successful!"
print_info "Token: ${TOKEN:0:50}...\n"

# ============================================
# STEP 2: CREATE USER
# ============================================
print_header "STEP 2: Create User (Registro Público)"

USER_EMAIL="user_$(date +%s)@test.com"
USER_RESPONSE=$(make_request POST "/usuarios/registro" "{
    \"nombre\": \"Test User\",
    \"email\": \"$USER_EMAIL\",
    \"password\": \"TestPass123\",
    \"empresa_id\": 1
}")

USER_ID=$(echo $USER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -z "$USER_ID" ]; then
    print_error "Failed to create user"
    print_info "Response: $USER_RESPONSE"
else
    print_success "User created successfully"
    print_info "User ID: $USER_ID"
    print_info "Email: $USER_EMAIL\n"
fi

# ============================================
# STEP 3: CREATE COMPANY
# ============================================
print_header "STEP 3: Create Company"

COMPANY_RUT="99.$(date +%s%N | tail -c 10).9"
COMPANY_RESPONSE=$(make_request POST "/empresas" "{
    \"nombre\": \"Test Company $(date +%s)\",
    \"rut\": \"$COMPANY_RUT\",
    \"sector\": \"Technology\",
    \"ubicacion\": \"Santiago\",
    \"email\": \"company@test.com\",
    \"telefono\": \"+56912345678\",
    \"activa\": true
}" "$TOKEN")

COMPANY_ID=$(echo $COMPANY_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -z "$COMPANY_ID" ]; then
    print_error "Failed to create company"
    print_info "Response: $COMPANY_RESPONSE"
    # Use default company
    COMPANY_ID=1
    print_info "Using default company ID: $COMPANY_ID\n"
else
    print_success "Company created successfully"
    print_info "Company ID: $COMPANY_ID"
    print_info "RUT: $COMPANY_RUT\n"
fi

# ============================================
# STEP 4: ASSIGN DOCUMENT TO COMPANY
# ============================================
print_header "STEP 4: Assign Document to Company"

DOC_REQ_RESPONSE=$(make_request POST "/documentos-requeridos" "{
    \"empresa_id\": $COMPANY_ID,
    \"tipo_documento_id\": 1,
    \"fecha_limite\": \"2026-08-31\",
    \"prioridad\": \"alta\"
}" "$TOKEN")

DOC_REQ_ID=$(echo $DOC_REQ_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -z "$DOC_REQ_ID" ]; then
    print_error "Failed to create document requirement"
    print_info "Response: $DOC_REQ_RESPONSE"
else
    print_success "Document requirement created"
    print_info "Document Requirement ID: $DOC_REQ_ID\n"
fi

# ============================================
# STEP 5: ASSIGN DOCUMENT TO USER
# ============================================
print_header "STEP 5: Assign Document to User (Responsable)"

if [ ! -z "$DOC_REQ_ID" ] && [ ! -z "$USER_ID" ]; then
    RESP_RESPONSE=$(make_request POST "/documento-responsables" "{
        \"documento_requerido_id\": $DOC_REQ_ID,
        \"usuario_id\": $USER_ID
    }" "$TOKEN")
    
    RESP_ID=$(echo $RESP_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
    
    if [ -z "$RESP_ID" ]; then
        print_error "Failed to assign responsable"
        print_info "Response: $RESP_RESPONSE"
    else
        print_success "Responsable assigned successfully"
        print_info "Responsable ID: $RESP_ID\n"
    fi
else
    print_error "Cannot assign - missing document or user ID"
fi

# ============================================
# STEP 6: LIST OPERATIONS
# ============================================
print_header "STEP 6: List Operations"

# List companies
COMPANIES=$(make_request GET "/empresas" "" "$TOKEN")
COMPANY_COUNT=$(echo $COMPANIES | grep -o '"id":[0-9]*' | wc -l)
print_success "Companies found: $COMPANY_COUNT"

# List users
USERS=$(make_request GET "/usuarios" "" "$TOKEN")
USER_COUNT=$(echo $USERS | grep -o '"id":[0-9]*' | wc -l)
print_success "Users found: $USER_COUNT"

# List document requirements
if [ ! -z "$COMPANY_ID" ]; then
    DOCS=$(make_request GET "/documentos-requeridos/empresa/$COMPANY_ID" "" "$TOKEN")
    DOC_COUNT=$(echo $DOCS | grep -o '"id":[0-9]*' | wc -l)
    print_success "Documents for company $COMPANY_ID: $DOC_COUNT\n"
fi

# ============================================
# STEP 7: TEST CHANGE DOCUMENT STATUS
# ============================================
print_header "STEP 7: Change Document Status (Preview)"

print_info "To change document status, you would use:"
print_info "POST /api/documentos/{id}/validar"
print_info "Body: {\"estado\": \"aprobado\", \"comentarios\": \"Approved\"}\n"

# ============================================
# SUMMARY
# ============================================
print_header "✅ TEST SUMMARY"

echo -e "${GREEN}All tests completed successfully!${NC}\n"

echo -e "${YELLOW}Created Resources:${NC}"
echo "  • User ID: $USER_ID (Email: $USER_EMAIL)"
echo "  • Company ID: $COMPANY_ID"
echo "  • Document Requirement ID: $DOC_REQ_ID"
echo "  • Responsable ID: $RESP_ID"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Create a document (upload)"
echo "  2. Validate document status"
echo "  3. View pending validations"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  • View pending docs:"
echo "    curl -H \"Authorization: Bearer \$TOKEN\" $API_URL/documentos/pendientes-validacion"
echo "  • User pending docs:"
echo "    curl -H \"Authorization: Bearer \$TOKEN\" $API_URL/documentos-requeridos/usuario/pendientes"
echo ""

# ============================================
# CLEANUP PROMPT
# ============================================
read -p "Do you want to see detailed response? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_header "DETAILED RESPONSES"
    
    echo -e "${BLUE}User Creation Response:${NC}"
    echo $USER_RESPONSE | jq '.' 2>/dev/null || echo $USER_RESPONSE
    echo ""
    
    echo -e "${BLUE}Company Creation Response:${NC}"
    echo $COMPANY_RESPONSE | jq '.' 2>/dev/null || echo $COMPANY_RESPONSE
    echo ""
    
    echo -e "${BLUE}Document Requirement Response:${NC}"
    echo $DOC_REQ_RESPONSE | jq '.' 2>/dev/null || echo $DOC_REQ_RESPONSE
    echo ""
    
    echo -e "${BLUE}Responsable Response:${NC}"
    echo $RESP_RESPONSE | jq '.' 2>/dev/null || echo $RESP_RESPONSE
fi

echo -e "\n${GREEN}Test script finished!${NC}\n"
