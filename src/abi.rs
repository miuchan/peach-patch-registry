use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

const MAX_PORT_COUNT: usize = 1_000_000;
const MAX_CPP_TYPE_BYTES: usize = 4_096;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebAbiRequest {
    pub module_type: String,
    pub param_count: usize,
    pub input_count: usize,
    pub output_count: usize,
    pub light_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebAbiReport {
    pub source: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum RackWebEnumIdentifier {
    Name(String),
    Repeated { base: String, count: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebEnumInfo {
    pub identifiers: Vec<RackWebEnumIdentifier>,
    #[serde(default)]
    pub assignments: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebPortEnums {
    pub params: Option<RackWebEnumInfo>,
    pub inputs: Option<RackWebEnumInfo>,
    pub outputs: Option<RackWebEnumInfo>,
    pub lights: Option<RackWebEnumInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebLayoutRequest {
    #[serde(default)]
    pub constants: BTreeMap<String, Value>,
    pub enums: RackWebPortEnums,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebEnumId {
    pub name: String,
    pub id: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebEnumLayout {
    pub count: i64,
    pub ids: Vec<RackWebEnumId>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebPortLayouts {
    pub params: Option<RackWebEnumLayout>,
    pub inputs: Option<RackWebEnumLayout>,
    pub outputs: Option<RackWebEnumLayout>,
    pub lights: Option<RackWebEnumLayout>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebLayoutReport {
    pub layouts: RackWebPortLayouts,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebIntegerRequest {
    #[serde(default)]
    pub constants: BTreeMap<String, Value>,
    pub expressions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebIntegerReport {
    pub values: Vec<Option<i64>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebNumberRequest {
    #[serde(default)]
    pub constants: BTreeMap<String, Value>,
    pub expressions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebNumberReport {
    pub values: Vec<Option<f64>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebStringRequest {
    #[serde(default)]
    pub constants: BTreeMap<String, Value>,
    pub expressions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebStringReport {
    pub values: Vec<Option<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebConfigExpansionRequest {
    #[serde(default)]
    pub constants: BTreeMap<String, Value>,
    pub calls: Vec<RackWebConfigExpansionCall>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebConfigExpansionCall {
    pub arguments_source: String,
    #[serde(default)]
    pub loops: Vec<RackWebConfigExpansionLoop>,
    #[serde(default)]
    pub string_bindings: Vec<RackWebConfigExpansionBinding>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebConfigExpansionLoop {
    pub variable: String,
    pub start_expression: String,
    pub end_expression: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebConfigExpansionBinding {
    pub name: String,
    pub expression: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RackWebConfigExpansionReport {
    pub expansions: Vec<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum ExpressionToken {
    Number(f64),
    Plus,
    Minus,
    Multiply,
    Divide,
    Remainder,
    LeftParenthesis,
    RightParenthesis,
    Question,
    Colon,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    Equal,
    NotEqual,
    ShiftLeft,
    ShiftRight,
    End,
}

fn tokenize_expression(source: &str) -> Option<Vec<ExpressionToken>> {
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index].is_ascii_whitespace() {
            index += 1;
            continue;
        }
        let remaining = &source[index..];
        let paired = [
            ("<<", ExpressionToken::ShiftLeft),
            (">>", ExpressionToken::ShiftRight),
            ("<=", ExpressionToken::LessEqual),
            (">=", ExpressionToken::GreaterEqual),
            ("==", ExpressionToken::Equal),
            ("!=", ExpressionToken::NotEqual),
        ];
        if let Some((operator, token)) = paired
            .iter()
            .find(|(operator, _)| remaining.starts_with(operator))
        {
            tokens.push(*token);
            index += operator.len();
            continue;
        }
        let token = match bytes[index] {
            b'+' => Some(ExpressionToken::Plus),
            b'-' => Some(ExpressionToken::Minus),
            b'*' => Some(ExpressionToken::Multiply),
            b'/' => Some(ExpressionToken::Divide),
            b'%' => Some(ExpressionToken::Remainder),
            b'(' => Some(ExpressionToken::LeftParenthesis),
            b')' => Some(ExpressionToken::RightParenthesis),
            b'?' => Some(ExpressionToken::Question),
            b':' => Some(ExpressionToken::Colon),
            b'<' => Some(ExpressionToken::Less),
            b'>' => Some(ExpressionToken::Greater),
            _ => None,
        };
        if let Some(token) = token {
            tokens.push(token);
            index += 1;
            continue;
        }
        if bytes[index].is_ascii_digit() || bytes[index] == b'.' {
            let start = index;
            let mut has_digit = false;
            while bytes.get(index).is_some_and(u8::is_ascii_digit) {
                has_digit = true;
                index += 1;
            }
            if bytes.get(index) == Some(&b'.') {
                index += 1;
                while bytes.get(index).is_some_and(u8::is_ascii_digit) {
                    has_digit = true;
                    index += 1;
                }
            }
            if !has_digit {
                return None;
            }
            if matches!(bytes.get(index), Some(b'e' | b'E')) {
                index += 1;
                if matches!(bytes.get(index), Some(b'+' | b'-')) {
                    index += 1;
                }
                let exponent = index;
                while bytes.get(index).is_some_and(u8::is_ascii_digit) {
                    index += 1;
                }
                if exponent == index {
                    return None;
                }
            }
            let number = source[start..index].parse::<f64>().ok()?;
            tokens.push(ExpressionToken::Number(number));
            continue;
        }
        return None;
    }
    tokens.push(ExpressionToken::End);
    Some(tokens)
}

struct ExpressionParser {
    tokens: Vec<ExpressionToken>,
    index: usize,
}

impl ExpressionParser {
    fn current(&self) -> ExpressionToken {
        self.tokens
            .get(self.index)
            .copied()
            .unwrap_or(ExpressionToken::End)
    }

    fn consume(&mut self, token: ExpressionToken) -> bool {
        if self.current() == token {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn parse(mut self) -> Option<f64> {
        let value = self.conditional()?;
        (self.current() == ExpressionToken::End && value.is_finite()).then_some(value)
    }

    fn conditional(&mut self) -> Option<f64> {
        let condition = self.equality()?;
        if !self.consume(ExpressionToken::Question) {
            return Some(condition);
        }
        let when_true = self.conditional()?;
        if !self.consume(ExpressionToken::Colon) {
            return None;
        }
        let when_false = self.conditional()?;
        Some(if condition != 0.0 {
            when_true
        } else {
            when_false
        })
    }

    fn equality(&mut self) -> Option<f64> {
        let mut value = self.relational()?;
        loop {
            if self.consume(ExpressionToken::Equal) {
                value = f64::from(value == self.relational()?);
            } else if self.consume(ExpressionToken::NotEqual) {
                value = f64::from(value != self.relational()?);
            } else {
                return Some(value);
            }
        }
    }

    fn relational(&mut self) -> Option<f64> {
        let mut value = self.shift()?;
        loop {
            if self.consume(ExpressionToken::Less) {
                value = f64::from(value < self.shift()?);
            } else if self.consume(ExpressionToken::LessEqual) {
                value = f64::from(value <= self.shift()?);
            } else if self.consume(ExpressionToken::Greater) {
                value = f64::from(value > self.shift()?);
            } else if self.consume(ExpressionToken::GreaterEqual) {
                value = f64::from(value >= self.shift()?);
            } else {
                return Some(value);
            }
        }
    }

    fn shift(&mut self) -> Option<f64> {
        let mut value = self.additive()?;
        loop {
            if self.consume(ExpressionToken::ShiftLeft) {
                let amount = (self.additive()? as i32) & 31;
                value = f64::from((value as i32).wrapping_shl(amount as u32));
            } else if self.consume(ExpressionToken::ShiftRight) {
                let amount = (self.additive()? as i32) & 31;
                value = f64::from((value as i32).wrapping_shr(amount as u32));
            } else {
                return Some(value);
            }
        }
    }

    fn additive(&mut self) -> Option<f64> {
        let mut value = self.multiplicative()?;
        loop {
            if self.consume(ExpressionToken::Plus) {
                value += self.multiplicative()?;
            } else if self.consume(ExpressionToken::Minus) {
                value -= self.multiplicative()?;
            } else {
                return Some(value);
            }
        }
    }

    fn multiplicative(&mut self) -> Option<f64> {
        let mut value = self.unary()?;
        loop {
            if self.consume(ExpressionToken::Multiply) {
                value *= self.unary()?;
            } else if self.consume(ExpressionToken::Divide) {
                value /= self.unary()?;
            } else if self.consume(ExpressionToken::Remainder) {
                value %= self.unary()?;
            } else {
                return value.is_finite().then_some(value);
            }
        }
    }

    fn unary(&mut self) -> Option<f64> {
        if self.consume(ExpressionToken::Plus) {
            self.unary()
        } else if self.consume(ExpressionToken::Minus) {
            Some(-self.unary()?)
        } else {
            self.primary()
        }
    }

    fn primary(&mut self) -> Option<f64> {
        if let ExpressionToken::Number(value) = self.current() {
            self.index += 1;
            return Some(value);
        }
        if self.consume(ExpressionToken::LeftParenthesis) {
            let value = self.conditional()?;
            return self
                .consume(ExpressionToken::RightParenthesis)
                .then_some(value);
        }
        None
    }
}

fn numeric_constants(values: &BTreeMap<String, Value>) -> BTreeMap<String, f64> {
    values
        .iter()
        .filter_map(|(name, value)| {
            value
                .as_f64()
                .filter(|number| number.is_finite())
                .map(|number| (name.clone(), number))
        })
        .collect()
}

fn replace_numeric_references(mut expression: String, constants: &BTreeMap<String, f64>) -> String {
    let mut composite = constants
        .iter()
        .filter(|(name, _)| {
            !name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        })
        .collect::<Vec<_>>();
    composite.sort_by_key(|(name, _)| std::cmp::Reverse(name.len()));
    for (name, value) in composite {
        expression = expression.replace(name, &value.to_string());
    }

    let log2 = regex::Regex::new(
        r"(?i)\bstd::log2\s*\(\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)\s*\)",
    )
    .expect("log2 expression pattern should compile");
    expression = log2
        .replace_all(&expression, |captures: &regex::Captures<'_>| {
            captures[1]
                .parse::<f64>()
                .map(f64::log2)
                .map(|value| value.to_string())
                .unwrap_or_else(|_| captures[0].to_owned())
        })
        .into_owned();
    let vco =
        regex::Regex::new(r"\bVCOConfig\s*<[^>]+>\s*::\s*additionalVCOParameterCount\s*\(\s*\)")
            .expect("VCO expression pattern should compile");
    expression = vco.replace_all(&expression, "0").into_owned();
    let fx = regex::Regex::new(r"\bFXConfig\s*<[^>]+>\s*::\s*([A-Za-z_]\w*)\s*\(\s*\)")
        .expect("FX expression pattern should compile");
    expression = fx
        .replace_all(&expression, |captures: &regex::Captures<'_>| {
            constants
                .get(&format!("FXConfig.{}", &captures[1]))
                .map(f64::to_string)
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();
    let qualified = regex::Regex::new(r"\b(?:[A-Za-z_]\w*::)+([A-Za-z_]\w*)\b")
        .expect("qualified constant pattern should compile");
    expression = qualified
        .replace_all(&expression, |captures: &regex::Captures<'_>| {
            constants
                .get(&captures[1])
                .map(f64::to_string)
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();
    let identifier =
        regex::Regex::new(r"\b[A-Za-z_]\w*\b").expect("constant identifier pattern should compile");
    identifier
        .replace_all(&expression, |captures: &regex::Captures<'_>| {
            constants
                .get(&captures[0])
                .map(f64::to_string)
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned()
}

fn numeric_value(value: &str, constants: &BTreeMap<String, f64>) -> Option<f64> {
    let raw = value.trim();
    if let Some(value) = constants.get(raw) {
        return value.is_finite().then_some(*value);
    }
    let static_cast = regex::Regex::new(
        r"\bstatic_cast\s*<\s*(?:float|double|int|unsigned|long|short|size_t)\s*>\s*\(\s*([^()]+?)\s*\)",
    )
    .expect("static cast pattern should compile");
    let c_cast = regex::Regex::new(r"\(\s*(?:float|double|int|unsigned|long|short|size_t)\s*\)")
        .expect("C cast pattern should compile");
    let float_suffix =
        regex::Regex::new(r"(?i)\b((?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)[f](\b|$)")
            .expect("float suffix pattern should compile");
    let integer_suffix =
        regex::Regex::new(r"\b(\d+)[uUlL]+\b").expect("integer suffix pattern should compile");
    let character =
        regex::Regex::new(r"'([^'\\]|\\.)'").expect("character literal pattern should compile");
    let mut normalized = raw.to_owned();
    for _ in 0..16 {
        let next = static_cast.replace_all(&normalized, "($1)").into_owned();
        if next == normalized {
            break;
        }
        normalized = next;
    }
    normalized = c_cast.replace_all(&normalized, "").into_owned();
    normalized = float_suffix.replace_all(&normalized, "$1$2").into_owned();
    normalized = integer_suffix.replace_all(&normalized, "$1").into_owned();
    normalized = character
        .replace_all(&normalized, |captures: &regex::Captures<'_>| {
            let character = match &captures[1] {
                r"\n" => '\n',
                r"\r" => '\r',
                r"\t" => '\t',
                r"\0" => '\0',
                r"\\" => '\\',
                r"\'" => '\'',
                value => value.chars().next().unwrap_or('\0'),
            };
            u32::from(character).to_string()
        })
        .into_owned();
    normalized = replace_numeric_references(normalized, constants);
    ExpressionParser {
        tokens: tokenize_expression(&normalized)?,
        index: 0,
    }
    .parse()
}

pub(crate) fn numeric_expression(value: &str, constants: &BTreeMap<String, f64>) -> Option<i64> {
    const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;
    let value = numeric_value(value, constants)?;
    (value.fract() == 0.0 && value.abs() <= MAX_SAFE_INTEGER).then_some(value as i64)
}

fn string_constants(values: &BTreeMap<String, Value>) -> BTreeMap<String, String> {
    values
        .iter()
        .filter_map(|(name, value)| value.as_str().map(|value| (name.clone(), value.to_owned())))
        .collect()
}

fn split_cpp_arguments(source: &str) -> Option<Vec<String>> {
    let mut result = Vec::new();
    let mut start = 0usize;
    let mut quote = None;
    let mut stack = Vec::new();
    let bytes = source.as_bytes();
    let mut index = 0usize;
    while index < bytes.len() {
        let current = bytes[index];
        if let Some(active_quote) = quote {
            if current == b'\\' {
                index = index.checked_add(2)?;
                continue;
            }
            if current == active_quote {
                quote = None;
            }
            index += 1;
            continue;
        }
        if matches!(current, b'"' | b'\'') {
            quote = Some(current);
            index += 1;
            continue;
        }
        match current {
            b'(' => stack.push(b')'),
            b'{' => stack.push(b'}'),
            b'[' => stack.push(b']'),
            b'<' => stack.push(b'>'),
            b')' | b'}' | b']' | b'>' if stack.last() == Some(&current) => {
                stack.pop();
            }
            b',' if stack.is_empty() => {
                result.push(source[start..index].trim().to_owned());
                start = index + 1;
            }
            _ => {}
        }
        index += 1;
    }
    if quote.is_some() || !stack.is_empty() {
        return None;
    }
    result.push(source[start..].trim().to_owned());
    Some(result)
}

fn json_string_literal_at(source: &str, start: usize) -> Option<(String, usize)> {
    let bytes = source.as_bytes();
    if bytes.get(start) != Some(&b'"') {
        return None;
    }
    let mut index = start + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index = index.checked_add(2)?,
            b'"' => {
                let end = index + 1;
                let value = serde_json::from_str::<String>(&source[start..end]).ok()?;
                return Some((value, end));
            }
            _ => index += 1,
        }
    }
    None
}

fn concatenated_string_expression(source: &str) -> Option<String> {
    let bytes = source.as_bytes();
    let mut index = 0usize;
    let mut parts = Vec::new();
    while index < bytes.len() {
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        if bytes.get(index) == Some(&b'+') {
            index += 1;
            while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
                index += 1;
            }
        }
        if index >= bytes.len() {
            return None;
        }
        let (part, end) = json_string_literal_at(source, index)?;
        parts.push(part);
        index = end;
        while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
            index += 1;
        }
        if index < bytes.len() && bytes[index] != b'+' && bytes[index] != b'"' {
            return None;
        }
    }
    if parts.is_empty() {
        return None;
    }
    let value = parts.concat();
    (!value.is_empty() && value.len() <= 65_536).then_some(value)
}

fn format_string_expression(source: &str, constants: &BTreeMap<String, f64>) -> Option<String> {
    let call = regex::Regex::new(r"^(?:rack::)?string::f\s*\(([\s\S]*)\)$")
        .expect("formatted string pattern should compile");
    let arguments_source = call.captures(source)?.get(1)?.as_str();
    let mut arguments = split_cpp_arguments(arguments_source)?.into_iter();
    let format_source = arguments.next()?;
    let format = serde_json::from_str::<String>(&format_source).ok()?;
    let values = arguments
        .map(|argument| numeric_expression(&argument, constants))
        .collect::<Option<Vec<_>>>()?;
    let token = regex::Regex::new(r"%[dic]").expect("format token pattern should compile");
    let mut index = 0usize;
    let formatted = token
        .replace_all(&format, |captures: &regex::Captures<'_>| {
            let value = values.get(index).copied().unwrap_or(0);
            index += 1;
            if &captures[0] == "%c" {
                let code = value.rem_euclid(65_536) as u32;
                char::from_u32(code)
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            } else {
                value.to_string()
            }
        })
        .into_owned();
    (!formatted.is_empty() && formatted.len() <= 65_536).then_some(formatted)
}

fn string_expression(
    value: &str,
    numbers: &BTreeMap<String, f64>,
    strings: &BTreeMap<String, String>,
) -> Option<String> {
    let mut normalized = value.trim().to_owned();
    if let Some(value) = strings.get(&normalized) {
        return (!value.is_empty() && value.len() <= 65_536).then(|| value.clone());
    }

    let indexed = regex::Regex::new(r"\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]")
        .expect("indexed string pattern should compile");
    normalized = indexed
        .replace_all(&normalized, |captures: &regex::Captures<'_>| {
            numeric_expression(&captures[2], numbers)
                .and_then(|index| strings.get(&format!("{}_{}", &captures[1], index)))
                .and_then(|value| serde_json::to_string(value).ok())
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();
    let named = regex::Regex::new(r"\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+\s*\[\s*\d+\s*\]\.name\b")
        .expect("named string pattern should compile");
    normalized = named
        .replace_all(&normalized, |captures: &regex::Captures<'_>| {
            strings
                .get(&captures[0])
                .and_then(|value| serde_json::to_string(value).ok())
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();
    let wrapper = regex::Regex::new(
        r#"\b(?:std::)?string\s*(?:\{\s*("(?:\\.|[^"\\])*")\s*\}|\(\s*("(?:\\.|[^"\\])*")\s*\))"#,
    )
    .expect("string wrapper pattern should compile");
    normalized = wrapper
        .replace_all(&normalized, |captures: &regex::Captures<'_>| {
            captures
                .get(1)
                .or_else(|| captures.get(2))
                .map(|value| value.as_str().to_owned())
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();

    if let Ok(value) = serde_json::from_str::<String>(&normalized) {
        return (!value.is_empty() && value.len() <= 65_536).then_some(value);
    }

    let to_string = regex::Regex::new(r"\bstd::to_string\s*\(([^()]*)\)")
        .expect("numeric string pattern should compile");
    let concatenated = to_string
        .replace_all(&normalized, |captures: &regex::Captures<'_>| {
            numeric_expression(&captures[1], numbers)
                .and_then(|value| serde_json::to_string(&value.to_string()).ok())
                .unwrap_or_else(|| captures[0].to_owned())
        })
        .into_owned();
    concatenated_string_expression(&concatenated)
        .or_else(|| format_string_expression(&normalized, numbers))
}

pub(crate) fn evaluate_static_string(value: &str) -> Option<String> {
    if let Ok(literal) = serde_json::from_str::<String>(value.trim()) {
        return (literal.len() <= 65_536).then_some(literal);
    }
    string_expression(value, &BTreeMap::new(), &BTreeMap::new())
}

fn replace_identifier_outside_strings(source: &str, name: &str, value: &str) -> String {
    let pattern = regex::Regex::new(&format!(r"(?-u:\b{}\b)", regex::escape(name)))
        .expect("validated identifier pattern should compile");
    let bytes = source.as_bytes();
    let mut result = String::with_capacity(source.len());
    let mut chunk_start = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        if !matches!(bytes[index], b'"' | b'\'') {
            index += 1;
            continue;
        }
        result.push_str(&pattern.replace_all(&source[chunk_start..index], value));
        let quote = bytes[index];
        let literal_start = index;
        index += 1;
        while index < bytes.len() {
            if bytes[index] == b'\\' {
                index = index.saturating_add(2);
            } else if bytes[index] == quote {
                index += 1;
                break;
            } else {
                index += 1;
            }
        }
        let literal_end = index.min(bytes.len());
        result.push_str(&source[literal_start..literal_end]);
        chunk_start = literal_end;
    }
    result.push_str(&pattern.replace_all(&source[chunk_start..], value));
    result
}

fn expand_config_call(
    call: &RackWebConfigExpansionCall,
    numbers: &BTreeMap<String, f64>,
    strings: &BTreeMap<String, String>,
) -> Result<Vec<String>, String> {
    let value = call
        .arguments_source
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let mut contexts = vec![BTreeMap::<String, i64>::new()];
    for config_loop in &call.loops {
        let mut expanded = Vec::new();
        for context in &contexts {
            let mut scoped = numbers.clone();
            scoped.extend(
                context
                    .iter()
                    .map(|(name, value)| (name.clone(), *value as f64)),
            );
            let Some(start) = numeric_expression(&config_loop.start_expression, &scoped) else {
                continue;
            };
            let Some(end) = numeric_expression(&config_loop.end_expression, &scoped) else {
                continue;
            };
            if end <= start || end - start > 256 {
                continue;
            }
            for index in start..end {
                let mut next = context.clone();
                next.insert(config_loop.variable.clone(), index);
                expanded.push(next);
            }
            if expanded.len() > 2_048 {
                break;
            }
        }
        contexts = expanded;
        if contexts.is_empty() || contexts.len() > 2_048 {
            break;
        }
    }
    if contexts.is_empty() {
        return Ok(vec![value]);
    }
    if contexts.len() > 65_536 {
        return Err("Rack Web configuration expansion is too large".to_owned());
    }
    let mut result = Vec::with_capacity(contexts.len());
    for context in contexts {
        let mut expanded = value.clone();
        for (identifier, replacement) in &context {
            expanded =
                replace_identifier_outside_strings(&expanded, identifier, &replacement.to_string());
        }
        let mut scoped = numbers.clone();
        scoped.extend(
            context
                .iter()
                .map(|(name, value)| (name.clone(), *value as f64)),
        );
        for binding in &call.string_bindings {
            let mut expression = binding.expression.clone();
            for (identifier, replacement) in &context {
                expression = replace_identifier_outside_strings(
                    &expression,
                    identifier,
                    &replacement.to_string(),
                );
            }
            if let Some(resolved) = string_expression(&expression, &scoped, strings) {
                let encoded = serde_json::to_string(&resolved)
                    .map_err(|error| format!("Cannot encode configuration string: {error}"))?;
                expanded = replace_identifier_outside_strings(&expanded, &binding.name, &encoded);
            }
        }
        if expanded.len() > 1_048_576 {
            return Err("Rack Web configuration expansion is too large".to_owned());
        }
        result.push(expanded);
    }
    Ok(result)
}

fn count_identifier(value: &str) -> bool {
    value.starts_with("NUM_")
        || value
            .strip_prefix("kNum")
            .and_then(|tail| tail.bytes().next())
            .is_some_and(|byte| byte.is_ascii_uppercase())
        || value
            .strip_prefix("Num")
            .and_then(|tail| tail.bytes().next())
            .is_some_and(|byte| byte.is_ascii_uppercase())
        || value
            .strip_prefix("num")
            .and_then(|tail| tail.bytes().next())
            .is_some_and(|byte| byte.is_ascii_uppercase())
        || value.ends_with("_LEN")
        || matches!(value, "Count" | "COUNT")
        || value.ends_with("_COUNT")
}

fn validate_identifier(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 1_024
        || !value.is_ascii()
        || !value
            .bytes()
            .next()
            .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
    {
        return Err(format!("Rack Web {label} is invalid"));
    }
    Ok(())
}

fn set_enum_id(ids: &mut Vec<RackWebEnumId>, name: String, id: i64) {
    if let Some(existing) = ids.iter_mut().find(|entry| entry.name == name) {
        existing.id = id;
    } else {
        ids.push(RackWebEnumId { name, id });
    }
}

fn enum_layout(
    info: &RackWebEnumInfo,
    constants: &BTreeMap<String, f64>,
) -> Result<RackWebEnumLayout, String> {
    if info.identifiers.len() > MAX_PORT_COUNT || info.assignments.len() > MAX_PORT_COUNT {
        return Err("Rack Web enum layout is too large".to_owned());
    }
    let mut known = constants.clone();
    let mut ids = Vec::new();
    let mut index = 0i64;
    for identifier in &info.identifiers {
        match identifier {
            RackWebEnumIdentifier::Name(name) => {
                validate_identifier(name, "enum identifier")?;
                if count_identifier(name) {
                    index = info
                        .assignments
                        .get(name)
                        .and_then(|value| numeric_expression(value, &known))
                        .unwrap_or(index)
                        .max(0);
                    break;
                }
                if let Some(value) = info
                    .assignments
                    .get(name)
                    .and_then(|value| numeric_expression(value, &known))
                {
                    index = value;
                }
                set_enum_id(&mut ids, name.clone(), index);
                known.insert(name.clone(), index as f64);
                index = index
                    .checked_add(1)
                    .ok_or_else(|| "Rack Web enum identifier overflowed".to_owned())?;
            }
            RackWebEnumIdentifier::Repeated { base, count } => {
                validate_identifier(base, "repeated enum identifier")?;
                if count.len() > 4_096 || count.contains('\0') {
                    return Err("Rack Web repeated enum count is invalid".to_owned());
                }
                let repeated = numeric_expression(count, &known).unwrap_or(0).max(0);
                if repeated > MAX_PORT_COUNT as i64 {
                    return Err("Rack Web repeated enum count is too large".to_owned());
                }
                for offset in 0..repeated {
                    let synthetic = if let Some(stem) = base.strip_suffix("_INPUT") {
                        format!("{stem}_{}_INPUT", offset + 1)
                    } else if let Some(stem) = base.strip_suffix("_OUTPUT") {
                        format!("{stem}_{}_OUTPUT", offset + 1)
                    } else {
                        format!("{base}_{}", offset + 1)
                    };
                    set_enum_id(&mut ids, synthetic, index + offset);
                }
                set_enum_id(&mut ids, base.clone(), index);
                known.insert(base.clone(), index as f64);
                index = index
                    .checked_add(repeated)
                    .ok_or_else(|| "Rack Web repeated enum overflowed".to_owned())?;
            }
        }
        if index > MAX_PORT_COUNT as i64 {
            return Err("Rack Web enum layout is too large".to_owned());
        }
    }
    Ok(RackWebEnumLayout { count: index, ids })
}

pub fn evaluate_rack_web_layout(
    request: &RackWebLayoutRequest,
) -> Result<RackWebLayoutReport, String> {
    if request.constants.len() > 65_536 {
        return Err("Rack Web ABI constant table is too large".to_owned());
    }
    for name in request.constants.keys() {
        if name.is_empty() || name.len() > 4_096 || name.contains('\0') {
            return Err("Rack Web ABI constant name is invalid".to_owned());
        }
    }
    let constants = numeric_constants(&request.constants);
    let layout = |info: &Option<RackWebEnumInfo>| {
        info.as_ref()
            .map(|value| enum_layout(value, &constants))
            .transpose()
    };
    Ok(RackWebLayoutReport {
        layouts: RackWebPortLayouts {
            params: layout(&request.enums.params)?,
            inputs: layout(&request.enums.inputs)?,
            outputs: layout(&request.enums.outputs)?,
            lights: layout(&request.enums.lights)?,
        },
    })
}

pub fn evaluate_rack_web_integers(
    request: &RackWebIntegerRequest,
) -> Result<RackWebIntegerReport, String> {
    if request.constants.len() > 65_536 || request.expressions.len() > 65_536 {
        return Err("Rack Web integer evaluation request is too large".to_owned());
    }
    for name in request.constants.keys() {
        if name.is_empty() || name.len() > 4_096 || name.contains('\0') {
            return Err("Rack Web integer constant name is invalid".to_owned());
        }
    }
    if request
        .expressions
        .iter()
        .any(|expression| expression.len() > 4_096 || expression.contains('\0'))
    {
        return Err("Rack Web integer expression is invalid".to_owned());
    }
    let constants = numeric_constants(&request.constants);
    Ok(RackWebIntegerReport {
        values: request
            .expressions
            .iter()
            .map(|expression| numeric_expression(expression, &constants))
            .collect(),
    })
}

pub fn evaluate_rack_web_numbers(
    request: &RackWebNumberRequest,
) -> Result<RackWebNumberReport, String> {
    if request.constants.len() > 65_536 || request.expressions.len() > 65_536 {
        return Err("Rack Web number evaluation request is too large".to_owned());
    }
    for name in request.constants.keys() {
        if name.is_empty() || name.len() > 4_096 || name.contains('\0') {
            return Err("Rack Web number constant name is invalid".to_owned());
        }
    }
    if request
        .expressions
        .iter()
        .any(|expression| expression.len() > 4_096 || expression.contains('\0'))
    {
        return Err("Rack Web number expression is invalid".to_owned());
    }
    let constants = numeric_constants(&request.constants);
    Ok(RackWebNumberReport {
        values: request
            .expressions
            .iter()
            .map(|expression| numeric_value(expression, &constants))
            .collect(),
    })
}

pub fn evaluate_rack_web_strings(
    request: &RackWebStringRequest,
) -> Result<RackWebStringReport, String> {
    if request.constants.len() > 65_536 || request.expressions.len() > 65_536 {
        return Err("Rack Web string evaluation request is too large".to_owned());
    }
    for (name, value) in &request.constants {
        if name.is_empty() || name.len() > 4_096 || name.contains('\0') {
            return Err("Rack Web string constant name is invalid".to_owned());
        }
        if value.as_str().is_some_and(|value| value.len() > 65_536) {
            return Err("Rack Web string constant value is too large".to_owned());
        }
    }
    if request
        .expressions
        .iter()
        .any(|expression| expression.len() > 4_096 || expression.contains('\0'))
    {
        return Err("Rack Web string expression is invalid".to_owned());
    }
    let numbers = numeric_constants(&request.constants);
    let strings = string_constants(&request.constants);
    Ok(RackWebStringReport {
        values: request
            .expressions
            .iter()
            .map(|expression| string_expression(expression, &numbers, &strings))
            .collect(),
    })
}

pub fn expand_rack_web_config_calls(
    request: &RackWebConfigExpansionRequest,
) -> Result<RackWebConfigExpansionReport, String> {
    if request.constants.len() > 65_536 || request.calls.len() > 65_536 {
        return Err("Rack Web configuration expansion request is too large".to_owned());
    }
    for name in request.constants.keys() {
        if name.is_empty() || name.len() > 4_096 || name.contains('\0') {
            return Err("Rack Web configuration constant name is invalid".to_owned());
        }
    }
    for call in &request.calls {
        if call.arguments_source.len() > 1_048_576
            || call.arguments_source.contains('\0')
            || call.loops.len() > 32
            || call.string_bindings.len() > 1_024
        {
            return Err("Rack Web configuration expansion input is invalid".to_owned());
        }
        for config_loop in &call.loops {
            validate_identifier(&config_loop.variable, "configuration loop variable")?;
            if config_loop.start_expression.len() > 4_096
                || config_loop.start_expression.contains('\0')
                || config_loop.end_expression.len() > 4_096
                || config_loop.end_expression.contains('\0')
            {
                return Err("Rack Web configuration loop expression is invalid".to_owned());
            }
        }
        for binding in &call.string_bindings {
            validate_identifier(&binding.name, "configuration string binding")?;
            if binding.expression.len() > 4_096 || binding.expression.contains('\0') {
                return Err("Rack Web configuration string binding is invalid".to_owned());
            }
        }
    }
    let numbers = numeric_constants(&request.constants);
    let strings = string_constants(&request.constants);
    Ok(RackWebConfigExpansionReport {
        expansions: request
            .calls
            .iter()
            .map(|call| expand_config_call(call, &numbers, &strings))
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn validate_cpp_type(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_CPP_TYPE_BYTES || !value.is_ascii() {
        return Err("Rack Web ABI module type is invalid".to_owned());
    }
    if !value.bytes().all(|byte| {
        byte.is_ascii_alphanumeric()
            || matches!(
                byte,
                b'_' | b':' | b'<' | b'>' | b',' | b' ' | b'*' | b'&' | b'-' | b'+' | b'.'
            )
    }) {
        return Err("Rack Web ABI module type contains unsupported syntax".to_owned());
    }
    let first = value
        .bytes()
        .find(|byte| !byte.is_ascii_whitespace())
        .ok_or_else(|| "Rack Web ABI module type is empty".to_owned())?;
    if !(first.is_ascii_alphabetic() || matches!(first, b'_' | b':')) {
        return Err("Rack Web ABI module type must start with a type name".to_owned());
    }
    let mut template_depth = 0usize;
    for byte in value.bytes() {
        match byte {
            b'<' => {
                template_depth = template_depth
                    .checked_add(1)
                    .ok_or_else(|| "Rack Web ABI module template is too deeply nested".to_owned())?
            }
            b'>' => {
                template_depth = template_depth
                    .checked_sub(1)
                    .ok_or_else(|| "Rack Web ABI module template is unbalanced".to_owned())?
            }
            _ => {}
        }
    }
    if template_depth != 0 {
        return Err("Rack Web ABI module template is unbalanced".to_owned());
    }
    Ok(())
}

pub fn generate_rack_web_abi(request: &RackWebAbiRequest) -> Result<RackWebAbiReport, String> {
    validate_cpp_type(&request.module_type)?;
    for (label, count) in [
        ("parameter", request.param_count),
        ("input", request.input_count),
        ("output", request.output_count),
        ("light", request.light_count),
    ] {
        if count > MAX_PORT_COUNT {
            return Err(format!("Rack Web ABI {label} count is too large"));
        }
    }
    Ok(RackWebAbiReport {
        source: format!(
            "template <> struct RackWebModuleTraits<{module}> {{ static constexpr int paramCount = {params}; static constexpr int inputCount = {inputs}; static constexpr int outputCount = {outputs}; static constexpr int lightCount = {lights}; }};\nRACK_WEB_EXPORTS({module})",
            module = request.module_type,
            params = request.param_count,
            inputs = request.input_count,
            outputs = request.output_count,
            lights = request.light_count,
        ),
    })
}
