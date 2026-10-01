package com.backendcreditos.mobile.data

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

data class MappedOperation(val entityId: String, val payload: JsonElement)

/** Part of an abono (or of a loan paid out) that went through a bank account instead of cash. */
data class BankSplit(val bankId: Int, val amount: String, val reference: String = "")

object OperationPayloadMapper {
    fun customer(
        firstName: String, lastName: String, sex: String, birthDate: String?,
        documentType: String, documentNumber: String, phone: String, email: String,
        occupation: String, personNote: String, department: String, city: String,
        neighborhood: String, street: String, maxCredit: String, nickname: String,
        customerNote: String, customerStatus: String, guarantorPersonId: String?
    ): JsonElement {
        require(firstName.isNotBlank() && lastName.isNotBlank()) { "Nombres y apellidos son obligatorios." }
        require(firstName.length <= 100 && lastName.length <= 100)
        val max = number(maxCredit, "Límite de crédito")
        require(max >= 0) { "El máximo cupo no puede ser negativo." }
        require(sex.length <= 20 && documentType.length <= 45 && documentNumber.length <= 45)
        require(phone.length <= 15 && email.length <= 100 && occupation.length <= 100)
        require(personNote.length <= 255 && department.length <= 50 && city.length <= 50)
        require(neighborhood.length <= 50 && street.length <= 50 && nickname.length <= 20)
        require(customerNote.length <= 255 && customerStatus.length <= 15)
        require(birthDate == null || birthDate.length <= 11)
        val guarantor = guarantorPersonId?.takeIf(String::isNotBlank)?.toIntOrNull()
        require(guarantorPersonId.isNullOrBlank() || guarantor != null) {
            "El ID de fiador debe ser un entero."
        }
        return buildJsonObject {
            put("nombres", firstName.trim())
            put("apellidos", lastName.trim())
            put("sexo", sex)
            put("fechaNacimiento", birthDate?.let(::JsonPrimitive) ?: JsonNull)
            put("tipoDocumento", documentType)
            put("numeroDocumento", documentNumber)
            put("telefono", phone)
            put("email", email)
            put("ocupacion", occupation)
            put("notaPersona", personNote)
            put("departamento", department)
            put("ciudad", city)
            put("barrio", neighborhood)
            put("calle", street)
            put("maxCredito", JsonPrimitive(max))
            put("apodo", nickname)
            put("notaCliente", customerNote)
            put("estadoCliente", customerStatus)
            put("fiadorPersonaId", guarantor?.let(::JsonPrimitive) ?: JsonNull)
        }
    }

    fun createCredit(
        creditId: String, customerId: String, concept: String, value: String, mode: String,
        term: String, loan: String, description: String, initialPayment: String, item: String,
        profit: String, additionalNumber: String, additionalValue: String, receiptType: String,
        series: String, receiptNumber: String, note: String, obligation: String, documentSequenceId: String,
        referenceCardId: String? = null, placement: String? = null,
        banks: List<BankSplit> = emptyList()
    ): MappedOperation {
        require(creditId.isNotBlank() && creditId.length <= 50)
        val customer = customerId.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El cliente debe tener un ID entero asignado por el servidor.")
        val sequence = documentSequenceId.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El ID del consecutivo del documento debe ser positivo.")
        require(mode in FREQUENCIES) { "Selecciona una frecuencia válida." }
        val plazo = term.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El plazo debe ser un entero positivo.")
        require((referenceCardId == null) == (placement == null)) {
            "La tarjeta de referencia y la ubicación deben viajar juntas."
        }
        require(placement == null || placement in setOf("antes", "despues")) {
            "Ubicación de tarjeta inválida."
        }
        val fields = buildJsonObject {
            require(concept.length <= 30 && description.length <= 65_535)
            require(additionalNumber.length <= 11 && receiptType.length <= 30)
            require(series.length <= 11 && receiptNumber.length <= 11 && note.length <= 65_535)
            require(obligation.length <= 11)
            put("idtarjeta", creditId)
            put("idcliente", JsonPrimitive(customer))
            put("idventa", JsonNull)
            put("concepto", concept)
            put("valor", JsonPrimitive(number(value, "Valor")))
            put("modo", mode)
            put("plazo", JsonPrimitive(plazo))
            put("prestamo", JsonPrimitive(number(loan, "Préstamo")))
            put("descripcion", description)
            put("cuotaInicial", JsonPrimitive(number(initialPayment, "Cuota inicial")))
            put("item", JsonPrimitive(number(item, "Orden")))
            put("utilidad", JsonPrimitive(number(profit, "Utilidad")))
            put("adicionalNumero", additionalNumber)
            put("adicionalValor", JsonPrimitive(number(additionalValue, "Valor adicional")))
            put("tipoComprobante", receiptType)
            put("serie", series)
            put("numero", receiptNumber)
            put("nota", note)
            put("obligacion", obligation.takeIf(String::isNotBlank)?.let(::JsonPrimitive) ?: JsonNull)
            put("detalleDocumentoSucursalId", JsonPrimitive(sequence))
            if (referenceCardId != null && placement != null) {
                put("tarjetaReferenciaId", referenceCardId)
                put("ubicacion", placement)
            }
            if (banks.isNotEmpty()) put("bancos", bankSplits(banks, number(loan, "Préstamo"), "préstamo"))
        }
        return MappedOperation(creditId, fields)
    }

    fun updateCredit(
        id: String, concept: String, value: String, mode: String, term: String, loan: String,
        description: String, item: String, profit: String, additionalNumber: String,
        additionalValue: String, receiptType: String, series: String, receiptNumber: String, note: String
    ) = MappedOperation(id, buildJsonObject {
        require(id.isNotBlank() && id.length <= 50)
        require(concept.length <= 30 && description.length <= 65_535)
        require(additionalNumber.length <= 11 && receiptType.length <= 30)
        require(series.length <= 11 && receiptNumber.length <= 11)
        put("concepto", concept)
        put("valor", JsonPrimitive(number(value, "Valor")))
        put("modo", mode.also { require(it in FREQUENCIES) })
        put("plazo", JsonPrimitive(term.toIntOrNull() ?: throw IllegalArgumentException("El plazo debe ser entero.")))
        put("prestamo", JsonPrimitive(number(loan, "Préstamo")))
        put("descripcion", description)
        put("item", JsonPrimitive(number(item, "Orden")))
        put("utilidad", JsonPrimitive(number(profit, "Utilidad")))
        put("adicionalNumero", additionalNumber)
        put("adicionalValor", JsonPrimitive(number(additionalValue, "Valor adicional")))
        put("tipoComprobante", receiptType)
        put("serie", series)
        put("numero", receiptNumber)
        put("nota", note)
    })

    fun updateTerms(id: String, mode: String, term: String, number: String, createdAt: String) =
        MappedOperation(id, buildJsonObject {
            require(id.isNotBlank() && id.length <= 50)
            require(number.length <= 11 && createdAt.length <= 19)
            put("modo", mode.also { require(it in FREQUENCIES) })
            put("plazo", JsonPrimitive(term.toIntOrNull() ?: throw IllegalArgumentException("El plazo debe ser entero.")))
            put("numero", number)
            put("createdAt", createdAt)
        })

    fun createPayment(
        creditId: String, paymentId: String, amount: String, description: String,
        banks: List<BankSplit> = emptyList(), changeConfirmed: Boolean = false
    ): MappedOperation {
        require(creditId.isNotBlank() && creditId.length <= 50)
        require(paymentId.isNotBlank() && paymentId.length <= 50)
        require(description.length <= 255)
        val positiveAmount = number(amount, "Abono")
        require(positiveAmount > 0.0) { "Ingresa un abono mayor que cero." }
        return MappedOperation(creditId, buildJsonObject {
            put("iddescripcion", paymentId)
            put("abono", JsonPrimitive(-positiveAmount))
            put("descripcion", description.takeIf(String::isNotBlank) ?: "Abono")
            if (banks.isNotEmpty()) {
                put("bancos", bankSplits(banks, positiveAmount, "abono", allowChange = true))
                putCashChange(banks, positiveAmount, changeConfirmed)
            }
        })
    }

    // Si por banco entra más que el abono, la diferencia se devuelve en efectivo y viaja declarada.
    fun cashChange(banks: List<BankSplit>, amount: Double): Double {
        if (banks.isEmpty()) return 0.0
        val extra = banks.sumOf { it.amount.replace(',', '.').trim().toDoubleOrNull() ?: 0.0 } - amount
        return if (extra > 0.004) Math.round(extra * 100.0) / 100.0 else 0.0
    }

    private fun JsonObjectBuilder.putCashChange(banks: List<BankSplit>, amount: Double, confirmed: Boolean) {
        val change = cashChange(banks, amount)
        if (change <= 0.0) return
        require(confirmed) { "Confirma el efectivo que devuelves." }
        put("vuelto", JsonPrimitive(change))
    }

    private fun bankSplits(
        banks: List<BankSplit>, total: Double, label: String, allowChange: Boolean = false
    ): JsonArray {
        require(banks.size <= 5) { "Máximo 5 bancos por movimiento." }
        require(banks.map { it.bankId }.toSet().size == banks.size) { "No repitas el mismo banco." }
        val amounts = banks.map { split ->
            require(split.bankId > 0) { "Selecciona un banco válido." }
            require(split.reference.trim().length <= 50) { "La referencia admite máximo 50 caracteres." }
            number(split.amount, "Valor por banco").also { require(it > 0.0) { "El valor por banco debe ser mayor que cero." } }
        }
        require(allowChange || amounts.sum() <= total + 0.004) { "Lo pagado por banco supera el $label." }
        return buildJsonArray {
            banks.zip(amounts).forEach { (split, value) ->
                add(buildJsonObject {
                    put("idbanco", JsonPrimitive(split.bankId))
                    put("valor", JsonPrimitive(value))
                    if (split.reference.isNotBlank()) put("referencia", split.reference.trim())
                })
            }
        }
    }

    // `banks` nulo deja el reparto por banco como estaba; una lista vacía lo borra y vuelve todo efectivo.
    fun updatePayment(
        id: String, amount: String, description: String,
        banks: List<BankSplit>? = null, changeConfirmed: Boolean = false
    ) = MappedOperation(id, buildJsonObject {
        require(id.isNotBlank() && id.length <= 50)
        require(description.length <= 255)
        val positiveAmount = number(amount, "Abono")
        require(positiveAmount > 0.0) { "Ingresa un abono mayor que cero." }
        put("abono", JsonPrimitive(-positiveAmount))
        put("descripcion", description)
        if (banks != null) {
            put("bancos", bankSplits(banks, positiveAmount, "abono", allowChange = true))
            putCashChange(banks, positiveAmount, changeConfirmed)
        }
    })

    // Gastos de ruta y bases. El importe viaja siempre positivo: el servidor le pone el signo
    // que guarda webgoez, para que una operación en cola no pueda invertir el cuadre.
    fun createExpense(
        accountingType: Int, name: String, amount: String, detail: String, payrollId: Int? = null
    ) = MappedOperation(newEntryId(), expenseBody(accountingType, name, amount, detail, payrollId))

    fun updateExpense(
        id: String, accountingType: Int, name: String, amount: String, detail: String, payrollId: Int? = null
    ): MappedOperation {
        require(id.isNotBlank() && id.length <= 50)
        return MappedOperation(id, expenseBody(accountingType, name, amount, detail, payrollId))
    }

    fun createBase(amount: String, detail: String) = MappedOperation(newEntryId(), baseBody(amount, detail))

    fun updateBase(id: String, amount: String, detail: String): MappedOperation {
        require(id.isNotBlank() && id.length <= 50)
        return MappedOperation(id, baseBody(amount, detail))
    }

    private fun expenseBody(
        accountingType: Int, name: String, amount: String, detail: String, payrollId: Int?
    ) = buildJsonObject {
        require(accountingType > 0) { "Elige el tipo de gasto." }
        require(name.isNotBlank() && name.length <= 50) { "Elige el concepto del gasto." }
        require(payrollId == null || payrollId > 0) { "La nómina elegida no es válida." }
        put("idtipo_contabilidad", JsonPrimitive(accountingType))
        put("nombre", name.trim())
        put("valor", JsonPrimitive(positiveAmount(amount)))
        putDetail(detail)
        if (payrollId != null) put("idnomina", JsonPrimitive(payrollId))
    }

    private fun baseBody(amount: String, detail: String) = buildJsonObject {
        put("valor", JsonPrimitive(positiveAmount(amount)))
        putDetail(detail)
    }

    private fun JsonObjectBuilder.putDetail(detail: String) {
        require(detail.length <= 250) { "El detalle no puede pasar de 250 letras." }
        if (detail.isNotBlank()) put("detalle", detail.trim())
    }

    private fun positiveAmount(amount: String): Double {
        val value = number(amount, "Valor")
        require(value > 0.0) { "Escribe un valor mayor que cero." }
        return value
    }

    // webgoez identifica estas filas con uniqid(): 13 caracteres hexadecimales.
    private fun newEntryId(): String =
        UUID.randomUUID().toString().replace("-", "").take(13)

    fun delete(id: String): MappedOperation {
        require(id.isNotBlank() && id.length <= 50)
        return MappedOperation(id, buildJsonObject { })
    }

    fun discount(id: String, amount: String, description: String) = MappedOperation(id, buildJsonObject {
        val value = number(amount, "Descuento")
        require(value > 0.0) { "El descuento debe ser mayor que cero." }
        require(id.isNotBlank() && id.length <= 50 && description.length <= 255)
        put("amount", JsonPrimitive(-value))
        if (description.isNotBlank()) put("descripcion", description)
    })

    fun interest(id: String, amount: String, term: String, description: String) = MappedOperation(id, buildJsonObject {
        val value = number(amount, "Interés")
        require(value > 0.0) { "El interés debe ser mayor que cero." }
        require(id.isNotBlank() && id.length <= 50 && description.length <= 255)
        val months = term.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El plazo adicional debe ser entero positivo.")
        put("amount", JsonPrimitive(value))
        put("plazo", JsonPrimitive(months))
        if (description.isNotBlank()) put("descripcion", description)
    })

    fun changeStatus(id: String, status: String) = MappedOperation(id, buildJsonObject {
        require(id.isNotBlank() && id.length <= 50)
        require(status in CREDIT_STATUSES) { "Estado de crédito no permitido." }
        put("status", status)
    })

    fun reorder(id: String, item: String) = MappedOperation(id, buildJsonObject {
        require(id.isNotBlank() && id.length <= 50)
        put("item", JsonPrimitive(number(item, "Orden")))
    })

    fun createComment(customerId: String, comment: String, type: String = "comentario"): MappedOperation {
        require(comment.length <= 255 && type.length <= 30)
        val customer = customerId.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El cliente debe tener un ID entero asignado por el servidor.")
        val id = UUID.randomUUID().toString()
        return MappedOperation(id, buildJsonObject {
            put("idcliente", JsonPrimitive(customer))
            put("comentario", comment)
            put("tipo", type)
        })
    }

    fun updateComment(id: String, comment: String) = MappedOperation(id, buildJsonObject {
        require(id.isNotBlank() && id.length <= 50 && comment.length <= 255)
        put("comentario", comment)
    })

    fun upsertAlert(
        customerId: String, entityId: String, icon: String, color: String, subject: String, message: String
    ): MappedOperation {
        val customer = customerId.toIntOrNull()?.takeIf { it > 0 }
            ?: throw IllegalArgumentException("El cliente debe tener un ID entero asignado por el servidor.")
        require(entityId.isNotBlank() && entityId.length <= 50)
        val safeSubject = subject.replace("/,", "")
        val safeMessage = message.replace("/,", "")
        require(safeSubject.length + safeMessage.length + icon.length + color.length + 6 <= 255) {
            "La alerta completa supera los 255 caracteres permitidos."
        }
        return MappedOperation(entityId, buildJsonObject {
            put("idcliente", JsonPrimitive(customer))
            put("alerta", "$icon/,$color/,$safeSubject/,$safeMessage")
        })
    }

    private fun number(value: String, label: String): Double {
        val parsed = value.toDoubleOrNull()
        require(parsed != null && parsed.isFinite()) { "$label debe ser numérico." }
        return parsed
    }

    private val FREQUENCIES = setOf("Diario", "Semanal", "Quincenal", "Mensual")
    private val CREDIT_STATUSES = setOf("moroso", "fallecio", "discapacitado")
}
