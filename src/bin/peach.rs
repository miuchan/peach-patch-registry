fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = peach_cli::consumer::run(&args) {
        eprintln!("peach: {error}");
        std::process::exit(1);
    }
}
