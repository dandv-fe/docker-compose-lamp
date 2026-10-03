package com.backendcreditos.mobile.network

object GraphQlDocuments {
    const val LOGIN = """
        mutation Login(${'$'}companyId: Int!, ${'$'}username: String!, ${'$'}password: String!) {
          login(companyId: ${'$'}companyId, username: ${'$'}username, password: ${'$'}password) {
            token expiresIn paymentExpiresAt
            user { userId companyId employeeId employeeMaxCredit isSuperAdministrator username firstName lastName companyName }
            company { id name }
            branches { id name type extraCharge officeId officeName }
          }
        }
    """
    const val START_BIOMETRIC_REGISTRATION = """
        mutation StartBiometricRegistration(${'$'}deviceId: String!) {
          startBiometricRegistration(deviceId: ${'$'}deviceId) {
            challengeId challenge expiresIn
          }
        }
    """
    const val FINISH_BIOMETRIC_REGISTRATION = """
        mutation FinishBiometricRegistration(
          ${'$'}deviceId: String!, ${'$'}challengeId: ID!, ${'$'}publicKeySpki: String!, ${'$'}signature: String!
        ) {
          finishBiometricRegistration(
            deviceId: ${'$'}deviceId,
            challengeId: ${'$'}challengeId,
            publicKeySpki: ${'$'}publicKeySpki,
            signature: ${'$'}signature
          ) { enabled }
        }
    """
    const val START_BIOMETRIC_LOGIN = """
        mutation StartBiometricLogin(${'$'}companyId: Int!, ${'$'}username: String!, ${'$'}deviceId: String!) {
          startBiometricLogin(companyId: ${'$'}companyId, username: ${'$'}username, deviceId: ${'$'}deviceId) {
            challengeId challenge expiresIn
          }
        }
    """
    const val BIOMETRIC_LOGIN = """
        mutation BiometricLogin(
          ${'$'}companyId: Int!,
          ${'$'}username: String!,
          ${'$'}deviceId: String!,
          ${'$'}challengeId: ID!,
          ${'$'}signature: String!
        ) {
          login: biometricLogin(
            companyId: ${'$'}companyId,
            username: ${'$'}username,
            deviceId: ${'$'}deviceId,
            challengeId: ${'$'}challengeId,
            signature: ${'$'}signature
          ) {
            token expiresIn paymentExpiresAt
            user { userId companyId employeeId employeeMaxCredit isSuperAdministrator username firstName lastName companyName }
            company { id name }
            branches { id name type extraCharge officeId officeName }
          }
        }
    """
    const val ME = """
        query Me {
          me {
            userId companyId employeeId employeeMaxCredit isSuperAdministrator username firstName lastName companyName
            branches { id name type extraCharge officeId officeName }
          }
        }
    """
    const val BRANCHES = """query Branches { branches { id name type extraCharge officeId officeName } }"""
    const val PERSON_DOCUMENT_TYPES = """
        query PersonDocumentTypes(${'$'}branchId: Int!) {
          personDocumentTypes(branchId: ${'$'}branchId) { name }
        }
    """
    const val CUSTOMER_CANDIDATE = """
        query CustomerCandidate(${'$'}branchId: Int!, ${'$'}documentType: String!, ${'$'}documentNumber: String!) {
          customerCandidate(branchId: ${'$'}branchId, documentType: ${'$'}documentType, documentNumber: ${'$'}documentNumber) {
            personId customerId firstName lastName sex birthDate documentType documentNumber
            phone email occupation personNote department city neighborhood street
          }
        }
    """
    const val PORTFOLIO = """
        query Portfolio(${'$'}branchId: Int!, ${'$'}first: Int!, ${'$'}after: String, ${'$'}snapshotCursor: String) {
          portfolio(branchId: ${'$'}branchId, first: ${'$'}first, after: ${'$'}after, snapshotCursor: ${'$'}snapshotCursor) {
            nodes {
              id companyId personId firstName lastName sex birthDate
              documentType documentNumber phone email photo occupation personStatus personNote
              phones { id phone normalizedPhone whatsappOpenCount whatsappLastOpenedAt invalid validityChangedBy validityChangedAt }
              department city neighborhood street maxCredit nickname note status rating guarantorPersonId
              credits {
                id companyId branchId customerId routeId saleId concept value frequency term principal balance
                description sortOrder profit additionalNumber additionalValue receiptType receiptSeries receiptNumber
                paymentSummary style note status createdEmployeeId agreementDate createdAt updatedAt bankFunded
                latestPayment { id creditId amount description state createdAt updatedAt routeId createdByUserId createdByUsername origin bankAmount }
                locations { id creditId name latitude longitude accuracy createdAt }
              }
              comments { id customerId comment type userId createdAt updatedAt }
            }
            snapshotCursor nextCursor hasNextPage
          }
        }
    """
    const val CUSTOMER_BY_ID = """
        query CustomerById(${'$'}branchId: Int!, ${'$'}id: Int!) {
          customerById(branchId: ${'$'}branchId, id: ${'$'}id) {
            id companyId personId firstName lastName sex birthDate
            documentType documentNumber phone email photo occupation personStatus personNote
            phones { id phone normalizedPhone whatsappOpenCount whatsappLastOpenedAt invalid validityChangedBy validityChangedAt }
            department city neighborhood street maxCredit nickname note status rating guarantorPersonId
            credits {
              id companyId branchId customerId routeId saleId concept value frequency term principal balance
              description sortOrder profit additionalNumber additionalValue receiptType receiptSeries receiptNumber
              paymentSummary style note status createdEmployeeId agreementDate createdAt updatedAt bankFunded
              latestPayment { id creditId amount description state createdAt updatedAt routeId createdByUserId createdByUsername origin bankAmount }
              locations { id creditId name latitude longitude accuracy createdAt }
            }
            comments { id customerId comment type userId createdAt updatedAt }
          }
        }
    """
    const val CUSTOMER_BY_DOCUMENT = """
        query CustomerByDocument(${'$'}branchId: Int!, ${'$'}documentType: String!, ${'$'}documentNumber: String!) {
          customerByDocument(branchId: ${'$'}branchId, documentType: ${'$'}documentType, documentNumber: ${'$'}documentNumber) {
            id companyId personId firstName lastName sex birthDate
            documentType documentNumber phone email photo occupation personStatus personNote
            phones { id phone normalizedPhone whatsappOpenCount whatsappLastOpenedAt invalid validityChangedBy validityChangedAt }
            department city neighborhood street maxCredit nickname note status rating guarantorPersonId
            credits {
              id companyId branchId customerId routeId saleId concept value frequency term principal balance
              description sortOrder profit additionalNumber additionalValue receiptType receiptSeries receiptNumber
              paymentSummary style note status createdEmployeeId agreementDate createdAt updatedAt bankFunded
              latestPayment { id creditId amount description state createdAt updatedAt routeId createdByUserId createdByUsername origin bankAmount }
              locations { id creditId name latitude longitude accuracy createdAt }
            }
            comments { id customerId comment type userId createdAt updatedAt }
          }
        }
    """
    const val PAYMENT_HISTORY = """
        query PaymentHistory(${'$'}branchId: Int!, ${'$'}creditId: ID!) {
          paymentHistory(branchId: ${'$'}branchId, creditId: ${'$'}creditId) {
            id creditId amount description state createdAt updatedAt routeId
            createdByUserId createdByUsername origin bankAmount
          }
        }
    """
    const val SYNC_CHANGES = """
        query SyncChanges(${'$'}branchId: Int!, ${'$'}after: String!, ${'$'}first: Int!) {
          syncChanges(branchId: ${'$'}branchId, after: ${'$'}after, first: ${'$'}first) {
            nodes { cursor recordType recordId action createdAt payload }
          }
        }
    """
    const val APPLY_OFFLINE_OPERATION = """
        mutation ApplyOfflineOperation(${'$'}input: OfflineOperationInput!) {
          applyOfflineOperation(input: ${'$'}input) {
            operationId status entityId data eventCursor replayed
          }
        }
    """
    const val BRANCH_PERMISSIONS = """
        query BranchPermissions(${'$'}branchId: Int!) { branchPermissions(branchId: ${'$'}branchId) }
    """
    const val BANK_ACCOUNTS = """
        query BankAccounts(${'$'}branchId: Int!) {
          bankAccounts(branchId: ${'$'}branchId) { id name type number holderName holderDocument }
        }
    """
    const val OPEN_ROUTE_CASH = """
        query OpenRouteCash(${'$'}branchId: Int!) {
          openRouteCash(branchId: ${'$'}branchId) { routeId routeState base otherIncome expenses }
        }
    """
    private const val SETTLEMENT_FIELDS = """
        routeId state canSettle base collected collectedBank otherCollected
        credits creditsBank expenses expectedCash
        movements { id kind title detail amount bankAmount countsForCash cashAmount personId personName state createdAt }
        collectors { personId personName cash movements isMe }
    """
    val ROUTE_SETTLEMENT = """
        query RouteSettlement(${'$'}branchId: Int!) {
          routeSettlement(branchId: ${'$'}branchId) { $SETTLEMENT_FIELDS }
        }
    """
    val SETTLE_ROUTE = """
        mutation SettleRoute(${'$'}branchId: Int!, ${'$'}cash: Float!, ${'$'}coins: Float!, ${'$'}difference: Float!) {
          settleRoute(branchId: ${'$'}branchId, cash: ${'$'}cash, coins: ${'$'}coins, difference: ${'$'}difference) {
            $SETTLEMENT_FIELDS
          }
        }
    """
    val ROUTE_ENTRIES = """
        query RouteEntries(${'$'}branchId: Int!) {
          routeEntries(branchId: ${'$'}branchId) {
            id kind name detail amount accountingType payrollId personName state createdAt
          }
        }
    """
    val ROUTE_EXPENSE_CATALOG = """
        query RouteExpenseCatalog(${'$'}branchId: Int!) {
          routeExpenseCatalog(branchId: ${'$'}branchId) {
            categories { id category names }
            payrolls { id name }
          }
        }
    """
    const val RECEIPT_SEQUENCES = """
        query ReceiptSequences(${'$'}branchId: Int!) {
          receiptSequences(branchId: ${'$'}branchId) { id documentType series lastNumber }
        }
    """
    const val ISSUE_RECEIPT_LINK = """
        mutation IssueReceiptLink(
          ${'$'}branchId: Int!, ${'$'}customerId: Int!, ${'$'}kind: String!,
          ${'$'}recordId: ID!, ${'$'}format: String!
        ) {
          issueReceiptLink(
            branchId: ${'$'}branchId, customerId: ${'$'}customerId, kind: ${'$'}kind,
            recordId: ${'$'}recordId, format: ${'$'}format
          ) { id url expiresAt }
        }
    """
    const val RECEIPT_LINKS = """
        query ReceiptLinks(${'$'}branchId: Int!, ${'$'}afterId: ID) {
          receiptLinks(branchId: ${'$'}branchId, afterId: ${'$'}afterId) {
            receiptLinks { id kind receiptType receiptSeries receiptNumber format createdAt expiresAt }
            hasMore
          }
        }
    """
    const val REVOKE_RECEIPT_LINK = """
        mutation RevokeReceiptLink(${'$'}branchId: Int!, ${'$'}id: ID!) {
          revokeReceiptLink(branchId: ${'$'}branchId, id: ${'$'}id)
        }
    """
    const val DEFAULTERS_OF_PORTFOLIO = """
        query DefaultersOfPortfolio(${'$'}branchId: Int!) {
          defaultersOfPortfolio(branchId: ${'$'}branchId) {
            id balance principal value additionalValue createdAt customerName documentType documentNumber phone
          }
        }
    """
    const val WITHDRAWN_OF_PORTFOLIO = """
        query WithdrawnOfPortfolio(${'$'}branchId: Int!) {
          withdrawnOfPortfolio(branchId: ${'$'}branchId) {
            id balance principal value additionalValue createdAt customerName documentType documentNumber phone status
          }
        }
    """
    const val CANCELLED_CREDITS = """
        query CancelledCredits(${'$'}branchId: Int!, ${'$'}dateFrom: String!, ${'$'}dateTo: String!) {
          cancelledCredits(branchId: ${'$'}branchId, dateFrom: ${'$'}dateFrom, dateTo: ${'$'}dateTo) {
            id value principal additionalValue createdAt customerName documentType documentNumber phone
            paidAmount description cancelledAt
          }
        }
    """
    const val PORTFOLIO_CLIENTS = """
        query PortfolioClients(${'$'}branchId: Int!) {
          portfolioClients(branchId: ${'$'}branchId) {
            personId firstName lastName documentType documentNumber sex birthDate occupation phone email
            department city neighborhood street customerStatus maxCredit nickname
          }
        }
    """
    const val RESTORE_CREDIT = """
        mutation RestoreCredit(${'$'}branchId: Int!, ${'$'}creditId: ID!) {
          restoreCredit(branchId: ${'$'}branchId, creditId: ${'$'}creditId) { id previousState state }
        }
    """
}
